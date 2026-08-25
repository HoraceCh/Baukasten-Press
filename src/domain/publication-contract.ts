/**
 * Phase 0 domain contract. This module deliberately defines no workflow
 * transition vocabulary: BAP-10 is the sole authority for that concern.
 */

export type EntityId = string;
export type CorrelationId = string;
export type IsoUtcTimestamp = string;
export type Sha256Hash = string;

export interface SourceNoteRef {
	readonly id: EntityId;
	readonly publicationItemId: EntityId;
	readonly correlationId: CorrelationId;
	readonly sourcePath: string;
	readonly version: number;
	readonly capturedAt: IsoUtcTimestamp;
	readonly content: string;
	readonly hashAlgorithm: 'sha-256';
	readonly contentHash: Sha256Hash;
}

/** The only mutable aggregate. `stage` is intentionally transition-neutral. */
export interface PublicationItem {
	readonly id: EntityId;
	readonly correlationId: CorrelationId;
	readonly sourceNoteRefId: EntityId;
	readonly version: number;
	readonly stage: string;
	readonly currentDraftId: EntityId | null;
	readonly createdAt: IsoUtcTimestamp;
	readonly updatedAt: IsoUtcTimestamp;
}

export type ProcessingOutcome =
	| { readonly status: 'produced'; readonly publicDraftId: EntityId; readonly validation: { readonly passed: boolean; readonly code: string; readonly summary: string } }
	| { readonly status: 'failed'; readonly failure: { readonly code: string; readonly summary: string } };

export interface ProcessingAttempt {
	readonly id: EntityId;
	readonly publicationItemId: EntityId;
	readonly correlationId: CorrelationId;
	readonly sequence: number;
	readonly kind: 'generate' | 'repair' | 'regenerate';
	readonly sourceNoteRefId: EntityId;
	readonly inputDraftId: EntityId | null;
	readonly startedAt: IsoUtcTimestamp;
	readonly completedAt: IsoUtcTimestamp;
	readonly outcome: ProcessingOutcome;
}

export interface PublicDraft {
	readonly id: EntityId;
	readonly publicationItemId: EntityId;
	readonly correlationId: CorrelationId;
	readonly sourceNoteRefId: EntityId;
	readonly version: number;
	readonly parentDraftId: EntityId | null;
	readonly origin: 'processing' | 'human';
	readonly processingAttemptId: EntityId | null;
	readonly createdAt: IsoUtcTimestamp;
	readonly content: string;
	readonly hashAlgorithm: 'sha-256';
	readonly contentHash: Sha256Hash;
}

export interface ReviewDecision {
	readonly id: EntityId;
	readonly publicationItemId: EntityId;
	readonly correlationId: CorrelationId;
	readonly publicDraftId: EntityId;
	readonly publicDraftVersion: number;
	readonly publicDraftContentHash: Sha256Hash;
	readonly decision: 'approved' | 'changes-requested';
	readonly reviewerId: string;
	readonly decidedAt: IsoUtcTimestamp;
	readonly summary: string | null;
	readonly supersedesReviewDecisionId: EntityId | null;
}

export type PublishOutcome =
	| { readonly status: 'succeeded'; readonly destinationReference: string; readonly destinationRevision: string | null; readonly receiptHash: Sha256Hash }
	| { readonly status: 'failed'; readonly failure: { readonly code: string; readonly summary: string } };

export interface PublishAttempt {
	readonly id: EntityId;
	readonly publicationItemId: EntityId;
	readonly correlationId: CorrelationId;
	readonly sequence: number;
	readonly publicDraftId: EntityId;
	readonly reviewDecisionId: EntityId;
	readonly destinationId: string;
	readonly destinationContractVersion: string;
	readonly confirmedBy: string;
	readonly confirmedAt: IsoUtcTimestamp;
	readonly startedAt: IsoUtcTimestamp;
	readonly completedAt: IsoUtcTimestamp;
	readonly outcome: PublishOutcome;
}

export interface PublishedRecord {
	readonly id: EntityId;
	readonly publicationItemId: EntityId;
	readonly correlationId: CorrelationId;
	readonly publishAttemptId: EntityId;
	readonly sourceNoteRefId: EntityId;
	readonly publicDraftId: EntityId;
	readonly reviewDecisionId: EntityId;
	readonly destinationId: string;
	readonly destinationContractVersion: string;
	readonly destinationReference: string;
	readonly destinationRevision: string | null;
	readonly receiptHash: Sha256Hash;
	readonly publishedAt: IsoUtcTimestamp;
}

export interface SourceRevisionSignal {
	readonly id: EntityId;
	readonly publicationItemId: EntityId;
	readonly correlationId: CorrelationId;
	readonly sourceNoteRefId: EntityId;
	readonly sequence: number;
	readonly kind: 'content-changed' | 'path-changed' | 'source-missing';
	readonly detectedAt: IsoUtcTimestamp;
	readonly baselinePath: string;
	readonly baselineContentHash: Sha256Hash;
	readonly observedPath: string | null;
	readonly observedContentHash: Sha256Hash | null;
}

export interface PublicationDomainGraph {
	readonly sourceNoteRefs: readonly SourceNoteRef[];
	readonly publicationItems: readonly PublicationItem[];
	readonly processingAttempts: readonly ProcessingAttempt[];
	readonly publicDrafts: readonly PublicDraft[];
	readonly reviewDecisions: readonly ReviewDecision[];
	readonly publishAttempts: readonly PublishAttempt[];
	readonly publishedRecords: readonly PublishedRecord[];
	readonly sourceRevisionSignals: readonly SourceRevisionSignal[];
}

export interface DomainValidationResult { readonly valid: boolean; readonly errors: readonly string[]; }

const HASH = /^[a-f0-9]{64}$/;
const validTimestamp = (value: string): boolean => {
	const parsed = new Date(value);
	return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
};
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const sha256 = async (content: string): Promise<Sha256Hash> => {
	const bytes = new TextEncoder().encode(content);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** Validates a complete in-memory graph without an ORM, storage, or workflow engine. */
export async function validatePublicationDomainGraph(graph: PublicationDomainGraph): Promise<DomainValidationResult> {
	const errors: string[] = [];
	const allRecords = [graph.sourceNoteRefs, graph.publicationItems, graph.processingAttempts, graph.publicDrafts, graph.reviewDecisions, graph.publishAttempts, graph.publishedRecords, graph.sourceRevisionSignals];
	const ids = new Set<string>();
	for (const records of allRecords) for (const record of records) {
		if (!nonEmpty(record.id)) errors.push('entity id must be non-empty');
		else if (ids.has(record.id)) errors.push(`duplicate global id: ${record.id}`);
		else ids.add(record.id);
	}
	const itemById = new Map(graph.publicationItems.map((item) => [item.id, item]));
	const sourceById = new Map(graph.sourceNoteRefs.map((source) => [source.id, source]));
	const draftById = new Map(graph.publicDrafts.map((draft) => [draft.id, draft]));
	const processingById = new Map(graph.processingAttempts.map((attempt) => [attempt.id, attempt]));
	const reviewById = new Map(graph.reviewDecisions.map((decision) => [decision.id, decision]));
	const publishById = new Map(graph.publishAttempts.map((attempt) => [attempt.id, attempt]));
	const owned = (itemId: string, correlationId: string, label: string): PublicationItem | undefined => {
		const item = itemById.get(itemId);
		if (!item) errors.push(`${label} references missing publication item: ${itemId}`);
		else if (item.correlationId !== correlationId) errors.push(`${label} correlation does not match item`);
		return item;
	};
	const sourceOwned = (sourceId: string, itemId: string, label: string): SourceNoteRef | undefined => {
		const source = sourceById.get(sourceId);
		if (!source) errors.push(`${label} references missing source note ref: ${sourceId}`);
		else if (source.publicationItemId !== itemId) errors.push(`${label} source note ref belongs to another item`);
		return source;
	};
	const timestamp = (value: string, label: string): void => { if (!validTimestamp(value)) errors.push(`${label} must be a UTC ISO timestamp`); };
	const hash = (value: string | null, label: string): void => { if (value !== null && !HASH.test(value)) errors.push(`${label} must be a lowercase SHA-256 hash`); };
	const contiguous = (values: readonly number[], label: string): void => {
		const sorted = [...values].sort((a, b) => a - b);
		if (sorted.some((value, index) => !Number.isInteger(value) || value !== index + 1)) errors.push(`${label} must be positive and contiguous from 1`);
	};

	for (const item of graph.publicationItems) {
		timestamp(item.createdAt, 'publication item createdAt'); timestamp(item.updatedAt, 'publication item updatedAt');
		if (!Number.isInteger(item.version) || item.version < 1) errors.push('publication item version must be positive');
		const source = sourceOwned(item.sourceNoteRefId, item.id, 'publication item');
		if (source && source.correlationId !== item.correlationId) errors.push('publication item source correlation does not match');
		if (item.currentDraftId !== null) { const draft = draftById.get(item.currentDraftId); if (!draft || draft.publicationItemId !== item.id) errors.push('publication item current draft must belong to item'); }
	}
	for (const source of graph.sourceNoteRefs) { owned(source.publicationItemId, source.correlationId, 'source note ref'); timestamp(source.capturedAt, 'source capturedAt'); hash(source.contentHash, 'source contentHash'); if (source.contentHash !== await sha256(source.content)) errors.push('source contentHash must match exact UTF-8 content'); if (!Number.isInteger(source.version) || source.version < 1) errors.push('source version must be positive'); }
	for (const item of graph.publicationItems) contiguous(graph.sourceNoteRefs.filter((x) => x.publicationItemId === item.id).map((x) => x.version), `source versions for ${item.id}`);

	for (const attempt of graph.processingAttempts) {
		owned(attempt.publicationItemId, attempt.correlationId, 'processing attempt'); sourceOwned(attempt.sourceNoteRefId, attempt.publicationItemId, 'processing attempt'); timestamp(attempt.startedAt, 'processing startedAt'); timestamp(attempt.completedAt, 'processing completedAt');
		if (attempt.inputDraftId !== null && draftById.get(attempt.inputDraftId)?.publicationItemId !== attempt.publicationItemId) errors.push('processing input draft must belong to item');
		if (attempt.outcome.status === 'produced') { const draft = draftById.get(attempt.outcome.publicDraftId); if (!draft || draft.processingAttemptId !== attempt.id || draft.publicationItemId !== attempt.publicationItemId) errors.push('produced processing attempt must reference its exact draft'); }
	}
	for (const item of graph.publicationItems) contiguous(graph.processingAttempts.filter((x) => x.publicationItemId === item.id).map((x) => x.sequence), `processing attempt sequences for ${item.id}`);

	for (const draft of graph.publicDrafts) {
		owned(draft.publicationItemId, draft.correlationId, 'public draft'); sourceOwned(draft.sourceNoteRefId, draft.publicationItemId, 'public draft'); timestamp(draft.createdAt, 'draft createdAt'); hash(draft.contentHash, 'draft contentHash'); if (draft.contentHash !== await sha256(draft.content)) errors.push('draft contentHash must match exact UTF-8 content');
		const parent = draft.parentDraftId === null ? undefined : draftById.get(draft.parentDraftId);
		if (draft.parentDraftId !== null && (!parent || parent.publicationItemId !== draft.publicationItemId || parent.version !== draft.version - 1)) errors.push('draft parent must be the preceding version of the same item');
		if (draft.origin === 'processing') { const attempt = draft.processingAttemptId === null ? undefined : processingById.get(draft.processingAttemptId); if (!attempt || attempt.outcome.status !== 'produced' || attempt.outcome.publicDraftId !== draft.id) errors.push('processing draft must claim an exact produced processing attempt'); }
		else if (draft.processingAttemptId !== null || draft.parentDraftId === null) errors.push('human draft requires a parent and no processing attempt');
	}
	for (const item of graph.publicationItems) contiguous(graph.publicDrafts.filter((x) => x.publicationItemId === item.id).map((x) => x.version), `draft versions for ${item.id}`);

	for (const decision of graph.reviewDecisions) {
		owned(decision.publicationItemId, decision.correlationId, 'review decision'); timestamp(decision.decidedAt, 'review decidedAt'); hash(decision.publicDraftContentHash, 'review draft hash');
		const draft = draftById.get(decision.publicDraftId);
		if (!draft || draft.publicationItemId !== decision.publicationItemId || draft.version !== decision.publicDraftVersion || draft.contentHash !== decision.publicDraftContentHash) errors.push('review decision must pin the exact draft version and hash');
		if (decision.supersedesReviewDecisionId !== null && reviewById.get(decision.supersedesReviewDecisionId)?.publicationItemId !== decision.publicationItemId) errors.push('superseded review decision must belong to item');
	}
	for (const attempt of graph.publishAttempts) {
		owned(attempt.publicationItemId, attempt.correlationId, 'publish attempt'); timestamp(attempt.confirmedAt, 'publish confirmedAt'); timestamp(attempt.startedAt, 'publish startedAt'); timestamp(attempt.completedAt, 'publish completedAt');
		const draft = draftById.get(attempt.publicDraftId); const review = reviewById.get(attempt.reviewDecisionId);
		if (!draft || !review || draft.publicationItemId !== attempt.publicationItemId || review.publicationItemId !== attempt.publicationItemId || review.decision !== 'approved' || review.publicDraftId !== attempt.publicDraftId) errors.push('publish attempt requires an exact approved decision for its draft');
		if (!nonEmpty(attempt.confirmedBy) || !nonEmpty(attempt.destinationId) || !nonEmpty(attempt.destinationContractVersion)) errors.push('publish attempt requires explicit confirmation and destination contract');
		if (attempt.outcome.status === 'succeeded') { hash(attempt.outcome.receiptHash, 'publish receiptHash'); if (!nonEmpty(attempt.outcome.destinationReference)) errors.push('successful publish attempt requires destination reference'); }
	}
	for (const item of graph.publicationItems) contiguous(graph.publishAttempts.filter((x) => x.publicationItemId === item.id).map((x) => x.sequence), `publish attempt sequences for ${item.id}`);
	for (const record of graph.publishedRecords) {
		owned(record.publicationItemId, record.correlationId, 'published record'); sourceOwned(record.sourceNoteRefId, record.publicationItemId, 'published record'); timestamp(record.publishedAt, 'record publishedAt'); hash(record.receiptHash, 'record receiptHash');
		const attempt = publishById.get(record.publishAttemptId); const review = reviewById.get(record.reviewDecisionId);
		if (!attempt || attempt.outcome.status !== 'succeeded') errors.push('published record requires a successful publish attempt');
		else if (attempt.publicationItemId !== record.publicationItemId || attempt.publicDraftId !== record.publicDraftId || attempt.reviewDecisionId !== record.reviewDecisionId || attempt.destinationId !== record.destinationId || attempt.destinationContractVersion !== record.destinationContractVersion || attempt.outcome.destinationReference !== record.destinationReference || attempt.outcome.destinationRevision !== record.destinationRevision || attempt.outcome.receiptHash !== record.receiptHash) errors.push('published record must exactly preserve successful attempt evidence');
		const draft = draftById.get(record.publicDraftId);
		if (!draft || draft.sourceNoteRefId !== record.sourceNoteRefId) errors.push('published record source note ref must match its published draft');
		if (!review || review.decision !== 'approved') errors.push('published record requires approved review evidence');
	}
	for (const attempt of graph.publishAttempts) { const count = graph.publishedRecords.filter((record) => record.publishAttemptId === attempt.id).length; if ((attempt.outcome.status === 'succeeded' && count !== 1) || (attempt.outcome.status === 'failed' && count !== 0)) errors.push('publish attempt must have exactly one record only when successful'); }
	for (const signal of graph.sourceRevisionSignals) { owned(signal.publicationItemId, signal.correlationId, 'source revision signal'); const source = sourceOwned(signal.sourceNoteRefId, signal.publicationItemId, 'source revision signal'); timestamp(signal.detectedAt, 'source signal detectedAt'); hash(signal.baselineContentHash, 'source signal baseline hash'); hash(signal.observedContentHash, 'source signal observed hash'); if (source && (source.sourcePath !== signal.baselinePath || source.contentHash !== signal.baselineContentHash)) errors.push('source revision signal must preserve source baseline'); }
	for (const item of graph.publicationItems) contiguous(graph.sourceRevisionSignals.filter((x) => x.publicationItemId === item.id).map((x) => x.sequence), `source signal sequences for ${item.id}`);
	return { valid: errors.length === 0, errors };
}

export async function assertValidPublicationDomainGraph(graph: PublicationDomainGraph): Promise<void> {
	const result = await validatePublicationDomainGraph(graph);
	if (!result.valid) throw new Error(`Invalid publication domain graph: ${result.errors.join('; ')}`);
}
