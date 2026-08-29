import assert from 'node:assert/strict';
import test from 'node:test';

import { PublicationQueue, createEmptyPublicationQueueData, migrateLegacyPublicationQueue } from '../src/application/publication-queue';

const at = '2026-08-29T00:00:00.000Z';
const digest = async (content: string): Promise<string> => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))), (byte) => byte.toString(16).padStart(2, '0')).join('');
const input = async (suffix: string, content = `source ${suffix}`) => ({ itemId: `item-${suffix}`, sourceNoteRefId: `source-${suffix}`, correlationId: `correlation-${suffix}`, sourcePath: `notes/${suffix}.md`, content, contentHash: await digest(content), capturedAt: at });
const persistent = () => { const writes: unknown[] = []; return { writes, save: async (value: unknown) => { writes.push(value); } }; };

test('enqueues immutable canonical sources, lists pending items, and rejects revision replay without selecting all', async () => {
	const storage = persistent(); const queue = new PublicationQueue(createEmptyPublicationQueueData(), storage);
	const first = await input('one');
	assert.equal(await queue.enqueue(first), 'added');
	assert.equal(await queue.enqueue({ ...first, itemId: 'new-item', sourceNoteRefId: 'new-source', correlationId: 'new-correlation' }), 'already-present');
	assert.deepEqual(queue.listPending().map((entry) => entry.workflow.item.id), ['item-one']);
	assert.equal(queue.snapshot().entries[0]?.workflow.item.stage, 'pending');
	assert.equal(queue.snapshot().entries[0]?.source.contentHash, first.contentHash);
	assert.equal(queue.snapshot().entries[0]?.source.sourcePath, first.sourcePath);
	assert.equal(storage.writes.length, 1);
});

test('selects only an explicit non-empty batch through BAP-10 and replays the same batch idempotently', async () => {
	const storage = persistent(); const queue = new PublicationQueue(createEmptyPublicationQueueData(), storage);
	const one = await input('one'); const two = await input('two');
	await queue.enqueue(one); await queue.enqueue(two);
	assert.equal(await queue.select({ batchId: 'batch-1', itemIds: ['item-one'], actorId: 'human', occurredAt: at }), 'selected');
	assert.deepEqual(queue.snapshot().entries.map((entry) => entry.workflow.item.stage), ['selected', 'pending']);
	assert.equal(await queue.select({ batchId: 'batch-1', itemIds: ['item-one'], actorId: 'human', occurredAt: at }), 'duplicate');
	assert.equal(storage.writes.length, 3);
});

test('rejects same-batch subset, superset, and changed-membership replays before transitions or saves', async () => {
	const storage = persistent(); const queue = new PublicationQueue(createEmptyPublicationQueueData(), storage);
	await queue.enqueue(await input('one')); await queue.enqueue(await input('two')); await queue.enqueue(await input('three'));
	await queue.select({ batchId: 'batch-membership', itemIds: ['item-one', 'item-two'], actorId: 'human', occurredAt: at });
	const before = structuredClone(queue.snapshot()); const writes = storage.writes.length;
	assert.equal(await queue.select({ batchId: 'batch-membership', itemIds: ['item-two', 'item-one'], actorId: 'human', occurredAt: at }), 'duplicate');
	for (const itemIds of [['item-one'], ['item-one', 'item-two', 'item-three'], ['item-three']]) {
		await assert.rejects(queue.select({ batchId: 'batch-membership', itemIds, actorId: 'human', occurredAt: at }));
		assert.deepEqual(queue.snapshot(), before); assert.equal(storage.writes.length, writes);
	}
});

test('rejects empty, duplicate, unknown, and later-state selection without logical changes', async () => {
	const storage = persistent(); const queue = new PublicationQueue(createEmptyPublicationQueueData(), storage); await queue.enqueue(await input('one'));
	const before = structuredClone(queue.snapshot());
	for (const itemIds of [[], ['item-one', 'item-one'], ['missing']]) await assert.rejects(queue.select({ batchId: `bad-${itemIds.join()}`, itemIds, actorId: 'human', occurredAt: at }));
	await queue.select({ batchId: 'first', itemIds: ['item-one'], actorId: 'human', occurredAt: at });
	await assert.rejects(queue.select({ batchId: 'second', itemIds: ['item-one'], actorId: 'human', occurredAt: at }));
	assert.deepEqual(before.entries[0]?.source, queue.snapshot().entries[0]?.source);
	assert.equal(queue.snapshot().entries[0]?.workflow.item.stage, 'selected');
});

test('derives an entire multi-item selection before one write and preserves state on transition or save failure', async () => {
	const storage = persistent(); const queue = new PublicationQueue(createEmptyPublicationQueueData(), storage); await queue.enqueue(await input('one')); await queue.enqueue(await input('two'));
	const beforeWrites = storage.writes.length;
	assert.equal(await queue.select({ batchId: 'both', itemIds: ['item-one', 'item-two'], actorId: 'human', occurredAt: at }), 'selected');
	assert.equal(storage.writes.length, beforeWrites + 1);
	assert.deepEqual(queue.snapshot().entries.map((entry) => entry.workflow.item.stage), ['selected', 'selected']);
	const failing = new PublicationQueue(createEmptyPublicationQueueData(), { save: async () => { throw new Error('save failed'); } }); await assert.rejects(failing.enqueue(await input('failure')));
	assert.equal(failing.snapshot().entries.length, 0);
	const invalid = new PublicationQueue(createEmptyPublicationQueueData(), persistent()); await assert.rejects(invalid.enqueue({ ...(await input('invalid')), contentHash: 'a'.repeat(64) }));
	assert.equal(invalid.snapshot().entries.length, 0);
});

test('selection save failure retains every pending item and permits a later complete selection', async () => {
	const seeded = new PublicationQueue(createEmptyPublicationQueueData(), persistent()); await seeded.enqueue(await input('one')); await seeded.enqueue(await input('two'));
	let fail = true; const durable: unknown[] = []; const queue = new PublicationQueue(seeded.snapshot(), { save: async (value) => { if (fail) throw new Error('selection save failed'); durable.push(value); } });
	const before = structuredClone(queue.snapshot());
	await assert.rejects(queue.select({ batchId: 'save-failure', itemIds: ['item-one', 'item-two'], actorId: 'human', occurredAt: at }));
	assert.deepEqual(queue.snapshot(), before); assert.equal(durable.length, 0); assert.deepEqual(queue.listPending().map((entry) => entry.workflow.item.id), ['item-one', 'item-two']);
	fail = false;
	assert.equal(await queue.select({ batchId: 'save-failure', itemIds: ['item-one', 'item-two'], actorId: 'human', occurredAt: at }), 'selected');
	assert.equal(durable.length, 1); assert.deepEqual(queue.snapshot().entries.map((entry) => entry.workflow.item.stage), ['selected', 'selected']);
});

test('serializes concurrent enqueue operations and migrates legacy fixtures through immutable captures', async () => {
	const storage = persistent(); const queue = new PublicationQueue(createEmptyPublicationQueueData(), storage); const source = await input('one');
	const results = await Promise.all([queue.enqueue(source), queue.enqueue({ ...source, itemId: 'other', sourceNoteRefId: 'other-source', correlationId: 'other-correlation' })]);
	assert.deepEqual(results.sort(), ['added', 'already-present']); assert.equal(queue.snapshot().entries.length, 1);
	const migrated = await migrateLegacyPublicationQueue({ schemaVersion: 1, queue: [{ sourcePath: 'notes/legacy.md', queuedAt: at }] }, async (sourcePath) => ({ sourcePath, content: 'legacy content', contentHash: await digest('legacy content'), capturedAt: at }));
	assert.equal(migrated.entries[0]?.workflow.item.stage, 'pending'); assert.equal(migrated.entries[0]?.source.contentHash, await digest('legacy content'));
});
