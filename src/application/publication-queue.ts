import { assertValidPublicationDomainGraph, type SourceNoteRef } from '../domain/publication-contract';
import { transitionPublication, type PublicationWorkflowState } from '../domain/publication-state-machine';

export const PUBLICATION_QUEUE_SCHEMA_VERSION = 2 as const;
type LegacyQueueData = { readonly schemaVersion: 1; readonly queue: readonly { readonly sourcePath: string; readonly queuedAt: string }[] };
export interface QueueEntry { readonly createdAt: string; readonly source: SourceNoteRef; readonly workflow: PublicationWorkflowState; }
interface SelectionMembership { readonly batchId: string; readonly itemIds: readonly string[]; }
export interface PublicationQueueData { readonly schemaVersion: typeof PUBLICATION_QUEUE_SCHEMA_VERSION; readonly entries: readonly QueueEntry[]; readonly selectionBatches: readonly SelectionMembership[]; }
export interface SourceCapture { readonly sourcePath: string; readonly content: string; readonly contentHash: string; readonly capturedAt: string; }
export interface QueuePersistence { save(data: PublicationQueueData): Promise<void>; }
export interface EnqueueInput extends SourceCapture { readonly itemId: string; readonly sourceNoteRefId: string; readonly correlationId: string; }
export interface SelectionInput { readonly batchId: string; readonly itemIds: readonly string[]; readonly actorId: string; readonly occurredAt: string; }

export function createEmptyPublicationQueueData(): PublicationQueueData { return { schemaVersion: PUBLICATION_QUEUE_SCHEMA_VERSION, entries: [], selectionBatches: [] }; }

const utc = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(new Date(value).valueOf()) && new Date(value).toISOString() === value;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const initialWorkflow = (source: SourceNoteRef): PublicationWorkflowState => ({
	item: { id: source.publicationItemId, correlationId: source.correlationId, version: 1, stage: 'pending', currentDraftId: null, updatedAt: source.capturedAt }, budgets: { repairs: 0, regenerations: 0 }, nextRecovery: null, activeOperation: null,
	sourceBaseline: { id: source.id, path: source.sourcePath, contentHash: source.contentHash }, currentValidation: null, approval: null, confirmation: null, processingAttempts: [], drafts: [], reviewDecisions: [], publishAttempts: [], publishedRecords: [], sourceRevisionSignals: [], audit: [], receipts: {},
});
const graphFor = (entries: readonly QueueEntry[]) => ({
	sourceNoteRefs: entries.map((entry) => entry.source), publicationItems: entries.map((entry) => ({ ...entry.workflow.item, sourceNoteRefId: entry.source.id, createdAt: entry.createdAt })), processingAttempts: entries.flatMap((entry) => entry.workflow.processingAttempts), publicDrafts: entries.flatMap((entry) => entry.workflow.drafts), reviewDecisions: entries.flatMap((entry) => entry.workflow.reviewDecisions), publishAttempts: entries.flatMap((entry) => entry.workflow.publishAttempts), publishedRecords: entries.flatMap((entry) => entry.workflow.publishedRecords), sourceRevisionSignals: entries.flatMap((entry) => entry.workflow.sourceRevisionSignals),
});
const validEntry = (value: unknown): value is QueueEntry => record(value) && utc(value.createdAt) && record(value.source) && record(value.workflow);
const validMembership = (value: unknown): value is SelectionMembership => record(value) && text(value.batchId) && Array.isArray(value.itemIds) && value.itemIds.length > 0 && value.itemIds.every(text) && new Set(value.itemIds).size === value.itemIds.length;
const legacy = (value: unknown): value is LegacyQueueData => record(value) && value.schemaVersion === 1 && Array.isArray(value.queue) && value.queue.every((entry) => record(entry) && text(entry.sourcePath) && utc(entry.queuedAt));

export async function parsePublicationQueueData(raw: unknown): Promise<PublicationQueueData> {
	if (!record(raw) || raw.schemaVersion !== PUBLICATION_QUEUE_SCHEMA_VERSION || !Array.isArray(raw.entries) || !raw.entries.every(validEntry) || !Array.isArray(raw.selectionBatches) || !raw.selectionBatches.every(validMembership)) return createEmptyPublicationQueueData();
	const data: PublicationQueueData = { schemaVersion: PUBLICATION_QUEUE_SCHEMA_VERSION, entries: raw.entries, selectionBatches: raw.selectionBatches };
	try { await assertValidPublicationDomainGraph(graphFor(data.entries)); } catch { return createEmptyPublicationQueueData(); }
	return data;
}

export async function migrateLegacyPublicationQueue(raw: unknown, capture: (sourcePath: string) => Promise<SourceCapture>): Promise<PublicationQueueData> {
	if (!legacy(raw)) return parsePublicationQueueData(raw);
	const entries: QueueEntry[] = [];
	for (const item of raw.queue) {
		const snapshot = await capture(item.sourcePath);
		if (snapshot.sourcePath !== item.sourcePath || typeof snapshot.content !== 'string' || !hash(snapshot.contentHash) || !utc(snapshot.capturedAt) || entries.some((entry) => entry.source.sourcePath === snapshot.sourcePath && entry.source.contentHash === snapshot.contentHash)) throw new Error('legacy queue migration requires one valid immutable source capture per revision');
		const id = `legacy:${snapshot.sourcePath}:${snapshot.contentHash}`;
		const source: SourceNoteRef = { id: `source:${id}`, publicationItemId: `item:${id}`, correlationId: `correlation:${id}`, sourcePath: snapshot.sourcePath, version: 1, capturedAt: snapshot.capturedAt, content: snapshot.content, hashAlgorithm: 'sha-256', contentHash: snapshot.contentHash };
		entries.push({ createdAt: item.queuedAt, source, workflow: initialWorkflow(source) });
	}
	const data: PublicationQueueData = { schemaVersion: PUBLICATION_QUEUE_SCHEMA_VERSION, entries, selectionBatches: [] };
	await assertValidPublicationDomainGraph(graphFor(data.entries)); return data;
}

export class PublicationQueue {
	private data: PublicationQueueData;
	private write: Promise<void> = Promise.resolve();
	public constructor(data: PublicationQueueData, private readonly persistence: QueuePersistence) { this.data = data; }
	public snapshot(): PublicationQueueData { return this.data; }
	public listPending(): readonly QueueEntry[] { return this.data.entries.filter((entry) => entry.workflow.item.stage === 'pending'); }
	public enqueue(input: EnqueueInput): Promise<'added' | 'already-present'> { return this.serial(async () => {
		if (!text(input.itemId) || !text(input.sourceNoteRefId) || !text(input.correlationId) || !text(input.sourcePath) || typeof input.content !== 'string' || !hash(input.contentHash) || !utc(input.capturedAt)) throw new Error('enqueue requires a complete immutable source capture');
		if (this.data.entries.some((entry) => entry.source.sourcePath === input.sourcePath && entry.source.contentHash === input.contentHash)) return 'already-present';
		const source: SourceNoteRef = { id: input.sourceNoteRefId, publicationItemId: input.itemId, correlationId: input.correlationId, sourcePath: input.sourcePath, version: 1, capturedAt: input.capturedAt, content: input.content, hashAlgorithm: 'sha-256', contentHash: input.contentHash };
		const next = { schemaVersion: PUBLICATION_QUEUE_SCHEMA_VERSION, entries: [...this.data.entries, { createdAt: input.capturedAt, source, workflow: initialWorkflow(source) }], selectionBatches: this.data.selectionBatches } as const;
		await assertValidPublicationDomainGraph(graphFor(next.entries)); await this.persistence.save(next); this.data = next; return 'added';
	}); }
	public select(input: SelectionInput): Promise<'selected' | 'duplicate'> { return this.serial(async () => {
		if (!text(input.batchId) || !text(input.actorId) || !utc(input.occurredAt) || input.itemIds.length === 0 || new Set(input.itemIds).size !== input.itemIds.length) throw new Error('selection requires a non-empty unique explicit batch');
		const selected = new Set(input.itemIds); if (this.data.entries.filter((entry) => selected.has(entry.workflow.item.id)).length !== selected.size) throw new Error('selection references an unknown item');
		const itemIds = [...input.itemIds].sort(); const membership = this.data.selectionBatches.find((batch) => batch.batchId === input.batchId);
		if (membership && (membership.itemIds.length !== itemIds.length || membership.itemIds.some((itemId, index) => itemId !== itemIds[index]))) throw new Error('selection batch membership conflicts with its original request');
		let duplicate = true;
		const entries = this.data.entries.map((entry) => { if (!selected.has(entry.workflow.item.id)) return entry; const id = `selection:${input.batchId}:${entry.workflow.item.id}`; const previous = entry.workflow.audit.find((audit) => audit.triggerId === id); const event = { id, itemId: entry.workflow.item.id, correlationId: entry.workflow.item.correlationId, expectedVersion: previous?.versionBefore ?? entry.workflow.item.version, kind: 'select_publication' as const, occurredAt: input.occurredAt, actorId: input.actorId, evidence: { code: 'BATCH_SELECTED', summary: `batch ${input.batchId}` } }; const result = transitionPublication(entry.workflow, event); if (!result.ok) throw new Error(`selection failed: ${result.code}`); duplicate &&= result.duplicate; return { ...entry, workflow: result.state }; });
		if (duplicate) return 'duplicate'; const next = { schemaVersion: PUBLICATION_QUEUE_SCHEMA_VERSION, entries, selectionBatches: [...this.data.selectionBatches, { batchId: input.batchId, itemIds }] } as const;
		await assertValidPublicationDomainGraph(graphFor(next.entries)); await this.persistence.save(next); this.data = next; return 'selected';
	}); }
	private serial<T>(operation: () => Promise<T>): Promise<T> { const result = this.write.then(operation); this.write = result.then(() => undefined, () => undefined); return result; }
}
