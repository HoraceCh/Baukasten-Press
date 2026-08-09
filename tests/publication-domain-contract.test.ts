import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePublicationDomainGraph, type PublicationDomainGraph } from '../src/domain/publication-contract';

const hash = (character: string): string => character.repeat(64);
const at = (second: number): string => `2026-08-09T00:00:${String(second).padStart(2, '0')}.000Z`;
const sha256 = async (content: string): Promise<string> => {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

async function completeGraph(): Promise<PublicationDomainGraph> {
	const sourceHash = await sha256('source');
	const draftHash = await sha256('draft');
	const editedDraftHash = await sha256('edited draft');
	return {
		publicationItems: [{ id: 'item-1', correlationId: 'correlation-1', sourceNoteRefId: 'source-1', version: 1, stage: 'opaque-stage', currentDraftId: 'draft-2', createdAt: at(1), updatedAt: at(12) }],
		sourceNoteRefs: [{ id: 'source-1', publicationItemId: 'item-1', correlationId: 'correlation-1', sourcePath: 'notes/source.md', version: 1, capturedAt: at(2), content: 'source', hashAlgorithm: 'sha-256', contentHash: sourceHash }],
		processingAttempts: [
			{ id: 'process-1', publicationItemId: 'item-1', correlationId: 'correlation-1', sequence: 1, kind: 'generate', sourceNoteRefId: 'source-1', inputDraftId: null, startedAt: at(3), completedAt: at(4), outcome: { status: 'failed', failure: { code: 'TEMPORARY', summary: 'retained failure' } } },
			{ id: 'process-2', publicationItemId: 'item-1', correlationId: 'correlation-1', sequence: 2, kind: 'generate', sourceNoteRefId: 'source-1', inputDraftId: null, startedAt: at(5), completedAt: at(6), outcome: { status: 'produced', publicDraftId: 'draft-1', validation: { passed: true, code: 'OK', summary: 'valid' } } },
		],
		publicDrafts: [
			{ id: 'draft-1', publicationItemId: 'item-1', correlationId: 'correlation-1', sourceNoteRefId: 'source-1', version: 1, parentDraftId: null, origin: 'processing', processingAttemptId: 'process-2', createdAt: at(6), content: 'draft', hashAlgorithm: 'sha-256', contentHash: draftHash },
			{ id: 'draft-2', publicationItemId: 'item-1', correlationId: 'correlation-1', sourceNoteRefId: 'source-1', version: 2, parentDraftId: 'draft-1', origin: 'human', processingAttemptId: null, createdAt: at(7), content: 'edited draft', hashAlgorithm: 'sha-256', contentHash: editedDraftHash },
		],
		reviewDecisions: [{ id: 'review-1', publicationItemId: 'item-1', correlationId: 'correlation-1', publicDraftId: 'draft-2', publicDraftVersion: 2, publicDraftContentHash: editedDraftHash, decision: 'approved', reviewerId: 'human-1', decidedAt: at(8), summary: null, supersedesReviewDecisionId: null }],
		publishAttempts: [
			{ id: 'publish-1', publicationItemId: 'item-1', correlationId: 'correlation-1', sequence: 1, publicDraftId: 'draft-2', reviewDecisionId: 'review-1', destinationId: 'horace-website', destinationContractVersion: '1', confirmedBy: 'human-1', confirmedAt: at(9), startedAt: at(9), completedAt: at(10), outcome: { status: 'failed', failure: { code: 'UNAVAILABLE', summary: 'retained failure' } } },
			{ id: 'publish-2', publicationItemId: 'item-1', correlationId: 'correlation-1', sequence: 2, publicDraftId: 'draft-2', reviewDecisionId: 'review-1', destinationId: 'horace-website', destinationContractVersion: '1', confirmedBy: 'human-1', confirmedAt: at(10), startedAt: at(10), completedAt: at(11), outcome: { status: 'succeeded', destinationReference: 'post-42', destinationRevision: '7', receiptHash: hash('d') } },
		],
		publishedRecords: [{ id: 'record-1', publicationItemId: 'item-1', correlationId: 'correlation-1', publishAttemptId: 'publish-2', sourceNoteRefId: 'source-1', publicDraftId: 'draft-2', reviewDecisionId: 'review-1', destinationId: 'horace-website', destinationContractVersion: '1', destinationReference: 'post-42', destinationRevision: '7', receiptHash: hash('d'), publishedAt: at(11) }],
		sourceRevisionSignals: [{ id: 'signal-1', publicationItemId: 'item-1', correlationId: 'correlation-1', sourceNoteRefId: 'source-1', sequence: 1, kind: 'content-changed', detectedAt: at(12), baselinePath: 'notes/source.md', baselineContentHash: sourceHash, observedPath: 'notes/source.md', observedContentHash: hash('e') }],
	};
}

async function invalid(graph: PublicationDomainGraph): Promise<void> { assert.equal((await validatePublicationDomainGraph(graph)).valid, false); }

test('accepts a complete graph that preserves failures before publication success', async () => {
	assert.deepEqual(await validatePublicationDomainGraph(await completeGraph()), { valid: true, errors: [] });
});

test('fails closed for duplicate ids and cross-item correlation', async () => {
	const duplicate = structuredClone(await completeGraph()); duplicate.publicDrafts[0]!.id = 'item-1'; await invalid(duplicate);
	const correlation = structuredClone(await completeGraph()); correlation.processingAttempts[0]!.correlationId = 'other'; await invalid(correlation);
});

test('fails closed for version, sequence, timestamp, shape, and exact content hash defects', async () => {
	const graph = structuredClone(await completeGraph()); graph.publicDrafts[1]!.version = 3; graph.publishAttempts[1]!.sequence = 3; graph.sourceNoteRefs[0]!.capturedAt = 'not-a-time'; graph.publicDrafts[0]!.contentHash = 'ABC'; await invalid(graph);
	const falseSource = structuredClone(await completeGraph()); falseSource.sourceNoteRefs[0]!.contentHash = hash('a'); await invalid(falseSource);
	const falseDraft = structuredClone(await completeGraph()); falseDraft.publicDrafts[0]!.contentHash = hash('b'); await invalid(falseDraft);
});

test('fails closed for invalid draft and review pins', async () => {
	const graph = structuredClone(await completeGraph()); graph.publicDrafts[1]!.parentDraftId = null; graph.reviewDecisions[0]!.publicDraftContentHash = hash('f'); await invalid(graph);
});

test('fails closed when processing evidence cannot prove its draft', async () => {
	const graph = structuredClone(await completeGraph());
	(graph.processingAttempts[1]!.outcome as { publicDraftId: string }).publicDraftId = 'missing-draft';
	await invalid(graph);
});

test('fails closed for unapproved publishing and records from failure or duplicate records', async () => {
	const unapproved = structuredClone(await completeGraph()); unapproved.reviewDecisions[0]!.decision = 'changes-requested'; await invalid(unapproved);
	const unconfirmed = structuredClone(await completeGraph()); unconfirmed.publishAttempts[0]!.confirmedBy = ''; await invalid(unconfirmed);
	const failedRecord = structuredClone(await completeGraph()); failedRecord.publishedRecords[0]!.publishAttemptId = 'publish-1'; await invalid(failedRecord);
	const duplicate = structuredClone(await completeGraph()); duplicate.publishedRecords.push({ ...duplicate.publishedRecords[0]!, id: 'record-2' }); await invalid(duplicate);
});

test('fails closed when published provenance uses another same-item source reference', async () => {
	const graph = structuredClone(await completeGraph());
	graph.sourceNoteRefs.push({ ...graph.sourceNoteRefs[0]!, id: 'source-2', sourcePath: 'notes/other.md', version: 2 });
	graph.publishedRecords[0]!.sourceNoteRefId = 'source-2';
	await invalid(graph);
});

test('a source revision signal does not change immutable published history', async () => {
	const graph = await completeGraph(); const before = JSON.stringify(graph.publishedRecords[0]);
	assert.equal((await validatePublicationDomainGraph(graph)).valid, true);
	assert.equal(JSON.stringify(graph.publishedRecords[0]), before);
});
