export const PUBLICATION_ATTEMPT_LIMITS = {
	maxRepairs: 2,
	maxRegenerations: 1,
} as const;

export type PublicationStage =
	| 'queued'
	| 'producing'
	| 'awaiting-human-review'
	| 'awaiting-publish-confirmation'
	| 'published'
	| 'needs-human-intervention';

export interface PendingQueueEntry {
	readonly sourcePath: string;
	readonly queuedAt: string;
}

export interface PublicationItem {
	readonly id: string;
	readonly sourcePath: string;
	stage: PublicationStage;
	repairAttempts: number;
	regenerationAttempts: number;
}

export interface DraftProvenance {
	readonly publicationItemId: string;
	readonly sourceSnapshotId: string;
	readonly publicCopyPath: string;
	readonly createdAt: string;
	readonly revision: number;
}

export interface PublishedRecord {
	readonly publicationItemId: string;
	readonly sourcePath: string;
	readonly publicCopyPath: string;
	readonly publishedAt: string;
	readonly destinationReference: string;
}

export interface PublicationScope {
	readonly publicCopiesDirectory: string;
	readonly runtimeDataDirectory: string;
}

export type AgentProviderKind =
	| 'opencode'
	| 'openai'
	| 'anthropic'
	| 'deepseek'
	| 'compatible-endpoint';

export interface AgentProfileReference {
	readonly id: string;
	readonly displayName: string;
	readonly provider: AgentProviderKind;
	readonly model: string;
}

export interface BaukastenPressSettings {
	publicationScope: PublicationScope | null;
	agentProfiles: AgentProfileReference[];
}
