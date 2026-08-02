import { MarkdownView, Notice, Plugin } from 'obsidian';

import {
	createEmptyPublicationQueueData,
	enqueueSource,
	parsePublicationQueueData,
	type PublicationQueueDataV1,
} from './application/publication-queue';

export default class BaukastenPressPlugin extends Plugin {
	private queueData: PublicationQueueDataV1 = createEmptyPublicationQueueData();
	private queueWrite: Promise<void> = Promise.resolve();

	async onload(): Promise<void> {
		try {
			this.queueData = parsePublicationQueueData(await this.loadData());
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
					this.enqueueCurrentNote(activeFile.path);
				}

				return true;
			},
		});
	}

	private enqueueCurrentNote(sourcePath: string): void {
		this.queueWrite = this.queueWrite
			.then(async () => {
				const result = enqueueSource(
					this.queueData,
					sourcePath,
					new Date().toISOString(),
				);

				if (result.status === 'already-queued') {
					new Notice(`已在待处理队列中：${sourcePath}`);
					return;
				}

				await this.saveData(result.data);
				this.queueData = result.data;
				new Notice(`已加入待处理队列：${sourcePath}`);
			})
			.catch((error: unknown) => {
				console.error('Baukasten Press could not add a note to its queue.', error);
				new Notice(`未能加入待处理队列：${sourcePath}。队列未更改，请重试。`);
			});
	}
}
