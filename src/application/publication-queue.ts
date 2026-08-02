import type { PendingQueueEntry } from '../domain/publication';

export const PUBLICATION_QUEUE_SCHEMA_VERSION = 1 as const;

export interface PublicationQueueDataV1 {
	readonly schemaVersion: typeof PUBLICATION_QUEUE_SCHEMA_VERSION;
	readonly queue: readonly PendingQueueEntry[];
}

export type EnqueueSourceResult =
	| {
			readonly status: 'added';
			readonly data: PublicationQueueDataV1;
	  }
	| {
			readonly status: 'already-queued';
			readonly data: PublicationQueueDataV1;
	  };

export function createEmptyPublicationQueueData(): PublicationQueueDataV1 {
	return {
		schemaVersion: PUBLICATION_QUEUE_SCHEMA_VERSION,
		queue: [],
	};
}

export function parsePublicationQueueData(rawData: unknown): PublicationQueueDataV1 {
	if (
		!isRecord(rawData) ||
		rawData.schemaVersion !== PUBLICATION_QUEUE_SCHEMA_VERSION ||
		!Array.isArray(rawData.queue)
	) {
		return createEmptyPublicationQueueData();
	}

	const seenSourcePaths = new Set<string>();
	const queue: PendingQueueEntry[] = [];

	for (const entry of rawData.queue) {
		if (!isPendingQueueEntry(entry) || seenSourcePaths.has(entry.sourcePath)) {
			continue;
		}

		seenSourcePaths.add(entry.sourcePath);
		queue.push(entry);
	}

	return {
		schemaVersion: PUBLICATION_QUEUE_SCHEMA_VERSION,
		queue,
	};
}

export function enqueueSource(
	data: PublicationQueueDataV1,
	sourcePath: string,
	queuedAt: string,
): EnqueueSourceResult {
	if (data.queue.some((entry) => entry.sourcePath === sourcePath)) {
		return {
			status: 'already-queued',
			data,
		};
	}

	return {
		status: 'added',
		data: {
			schemaVersion: PUBLICATION_QUEUE_SCHEMA_VERSION,
			queue: [...data.queue, { sourcePath, queuedAt }],
		},
	};
}

function isPendingQueueEntry(value: unknown): value is PendingQueueEntry {
	return (
		isRecord(value) &&
		typeof value.sourcePath === 'string' &&
		value.sourcePath.length > 0 &&
		typeof value.queuedAt === 'string' &&
		Number.isFinite(Date.parse(value.queuedAt))
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
