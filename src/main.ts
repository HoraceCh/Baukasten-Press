import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';

import {
	PublicationQueue,
	migrateLegacyPublicationQueue,
	type SourceCapture,
} from './application/publication-queue';

export default class BaukastenPressPlugin extends Plugin {
	private queue: PublicationQueue | null = null;

	async onload(): Promise<void> {
		try {
			const rawData: unknown = await this.loadData();
			const data = await migrateLegacyPublicationQueue(rawData, (sourcePath) => this.captureSource(sourcePath));
			this.queue = new PublicationQueue(data, { save: (next) => this.saveData(next) });
			if (hasSchemaVersion(rawData, 1)) await this.saveData(data);
		} catch (error) {
			console.error('Baukasten Press could not load its publication queue.', error);
			new Notice(
				'无法加载待处理队列。未更改任何数据，请重新加载插件后重试。',
			);
			return;
		}

		this.addCommand({
			id: 'add-current-note-to-queue',
			name: '加入待处理队列',
			checkCallback: (checking) => {
				const activeFile = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;

				if (!activeFile) {
					return false;
				}

				if (!checking) {
					void this.enqueueCurrentNote(activeFile);
				}

				return true;
			},
		});
	}

	private async enqueueCurrentNote(file: TFile): Promise<void> {
		if (!this.queue) return;
		try {
			const source = await this.captureSource(file.path);
			const result = await this.queue.enqueue({ ...source, itemId: crypto.randomUUID(), sourceNoteRefId: crypto.randomUUID(), correlationId: crypto.randomUUID() });
			new Notice(result === 'added' ? `已加入待处理队列：${file.path}` : `该修订已在队列中：${file.path}`);
		} catch (error: unknown) {
			console.error('Baukasten Press could not add a note to its queue.', error);
			new Notice(`未能加入待处理队列：${file.path}。队列未更改，请重试。`);
		}
	}

	private async captureSource(sourcePath: string): Promise<SourceCapture> {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) throw new Error('source note is unavailable');
		const content = await this.app.vault.read(file);
		const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
		const contentHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
		return { sourcePath, content, contentHash, capturedAt: new Date().toISOString() };
	}
}

function hasSchemaVersion(value: unknown, version: number): value is { readonly schemaVersion: number } {
	return typeof value === 'object' && value !== null && !Array.isArray(value) && 'schemaVersion' in value && value.schemaVersion === version;
}
