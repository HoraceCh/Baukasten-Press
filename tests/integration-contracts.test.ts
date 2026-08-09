import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, receiptHashForPublishSuccess, validateCapturedSourceReplay, validatePublishAdapterRequestV1, validatePublishAdapterResultV1, validateSourceIntakeRequestV1, validateSourceIntakeResultV1, type PublishAdapterRequestV1, type PublishAdapterResultV1, type SourceIntakeRequestV1, type SourceIntakeResultV1 } from '../src/contracts/integration-contracts';

const at = (second: number): string => `2026-08-09T00:00:${String(second).padStart(2, '0')}.000Z`;
const sha256 = async (content: string): Promise<string> => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))), (byte) => byte.toString(16).padStart(2, '0')).join('');
const intake = (): SourceIntakeRequestV1 => ({ contractVersion: '1.0', sourceNoteRefId: 'source-1', publicationItemId: 'item-1', correlationId: 'correlation-1', sourceVersion: 1, sourcePath: 'notes/source.md', requestedAt: at(1) });
const publish = async (): Promise<PublishAdapterRequestV1> => ({ contractVersion: '1.0', requestId: 'publish-operation-1', publicationItemId: 'item-1', correlationId: 'correlation-1', destinationId: 'horace-website', sourceNoteRefId: 'source-1', sourceContentHash: await sha256('source'), publicDraftId: 'draft-1', publicDraftVersion: 1, publicDraftContentHash: await sha256('draft'), publicDraftContent: 'draft', reviewDecisionId: 'review-1', confirmationId: 'confirmation-1', confirmedBy: 'human-1', confirmedAt: at(2), requestedAt: at(3) });
const captured = async (): Promise<Extract<SourceIntakeResultV1, { status: 'captured' }>> => ({ contractVersion: '1.0', sourceNoteRefId: 'source-1', publicationItemId: 'item-1', correlationId: 'correlation-1', sourceVersion: 1, sourcePath: 'notes/source.md', status: 'captured', capturedAt: at(2), sourceModifiedAt: null, contentEncoding: 'utf-8', content: 'source', hashAlgorithm: 'sha-256', contentHash: await sha256('source') });
const success = async (): Promise<Extract<PublishAdapterResultV1, { status: 'succeeded' }>> => { const request = await publish(); return { ...Object.fromEntries(Object.entries(request).filter(([key]) => key !== 'publicDraftContent' && key !== 'requestedAt')), status: 'succeeded', downstreamId: 'post-42', downstreamUrl: 'https://horace.example/posts/42', downstreamRevision: '7' } as Extract<PublishAdapterResultV1, { status: 'succeeded' }>; };

test('accepts exact source request/capture and immutable byte-identical replay', async () => {
	const request = intake(); const response = await captured();
	assert.deepEqual(validateSourceIntakeRequestV1(request), { valid: true, errors: [] });
	assert.deepEqual(await validateSourceIntakeResultV1(request, response), { valid: true, errors: [] });
	assert.deepEqual(validateCapturedSourceReplay(response, structuredClone(response)), { valid: true, errors: [] });
	assert.equal(validateCapturedSourceReplay(response, { ...response, content: 'changed' }).valid, false);
});
test('rejects unsafe source paths, versions, timestamps, hashes, pins and partial failures', async () => {
	assert.equal(validateSourceIntakeRequestV1({ ...intake(), sourcePath: '../.obsidian/app.json' }).valid, false);
	assert.equal(validateSourceIntakeRequestV1({ ...intake(), sourcePath: '.Obsidian/app.json' }).valid, false);
	assert.equal(validateSourceIntakeRequestV1({ ...intake(), sourceVersion: 0, requestedAt: 'bad' }).valid, false);
	const response = await captured(); assert.equal((await validateSourceIntakeResultV1(intake(), { ...response, contentHash: 'A'.repeat(64) })).valid, false);
	assert.equal((await validateSourceIntakeResultV1(intake(), { ...response, correlationId: 'wrong' })).valid, false);
	const failed = { contractVersion: '1.0', sourceNoteRefId: 'source-1', publicationItemId: 'item-1', correlationId: 'correlation-1', sourceVersion: 1, sourcePath: 'notes/source.md', status: 'failed', error: { code: 'unavailable', summary: 'temporarily unavailable', retryable: true }, content: 'leak' };
	assert.equal((await validateSourceIntakeResultV1(intake(), failed)).valid, false);
});
test('accepts exact publish request and normalized success/failure envelopes', async () => {
	const request = await publish(); const succeeded = await success();
	assert.deepEqual(await validatePublishAdapterRequestV1(request), { valid: true, errors: [] });
	assert.deepEqual(await validatePublishAdapterResultV1(request, succeeded), { valid: true, errors: [] });
	const failed: PublishAdapterResultV1 = { ...Object.fromEntries(Object.entries(succeeded).filter(([key]) => !['status', 'downstreamId', 'downstreamUrl', 'downstreamRevision'].includes(key))), status: 'failed', error: { code: 'timeout', summary: 'destination timed out', retryable: true, downstreamStatus: 504 } } as PublishAdapterResultV1;
	assert.deepEqual(await validatePublishAdapterResultV1(request, failed), { valid: true, errors: [] });
});
test('fails closed for unsupported version, stale confirmation, leaked workflow data and pin mismatches', async () => {
	const request = await publish(); const succeeded = await success();
	assert.equal((await validatePublishAdapterRequestV1({ ...request, contractVersion: '1.1' })).valid, false);
	assert.equal((await validatePublishAdapterRequestV1({ ...request, confirmedAt: at(4) })).valid, false);
	assert.equal((await validatePublishAdapterRequestV1({ ...request, publicDraftContentHash: 'a'.repeat(64) })).valid, false);
	assert.equal((await validatePublishAdapterRequestV1({ ...request, stage: 'publishing' })).valid, false);
	assert.equal((await validatePublishAdapterResultV1(request, { ...succeeded, requestId: 'reused-with-other-payload' })).valid, false);
	assert.equal((await validatePublishAdapterResultV1(request, { ...succeeded, destinationId: 'other' })).valid, false);
	assert.equal((await validatePublishAdapterResultV1(request, { ...succeeded, downstreamUrl: '/relative' })).valid, false);
});
test('rejects unsafe normalized errors and preserves recursive canonical receipt evidence', async () => {
	const request = await publish(); const succeeded = await success();
	const bad = { ...Object.fromEntries(Object.entries(succeeded).filter(([key]) => !['status', 'downstreamId', 'downstreamUrl', 'downstreamRevision'].includes(key))), status: 'failed', error: { code: 'unknown-code', summary: 'Bearer token=secret', retryable: 'yes' } };
	assert.equal((await validatePublishAdapterResultV1(request, bad)).valid, false);
	assert.equal(canonicalJson({ b: [{ z: null, a: 1 }], a: true }), canonicalJson({ a: true, b: [{ a: 1, z: null }] }));
	const first = await receiptHashForPublishSuccess(succeeded); const reordered = JSON.parse(JSON.stringify(succeeded, Object.keys(succeeded).reverse())) as PublishAdapterResultV1;
	assert.equal(first, await receiptHashForPublishSuccess(reordered));
	assert.notEqual(first, await receiptHashForPublishSuccess({ ...succeeded, downstreamRevision: '8' }));
});
