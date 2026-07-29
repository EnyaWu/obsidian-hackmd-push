import { Modal, Notice, Plugin, TFile } from "obsidian";
import { HackMDPushSettings, HackMDPushSettingTab, DEFAULT_SETTINGS } from "./settings";
import { HackMDClient, HackMDError } from "./hackmd-client";
import { readHackMDMeta, writeHackMDMeta } from "./frontmatter";

export default class HackMDPushPlugin extends Plugin {
	settings: HackMDPushSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// Ribbon icon
		this.addRibbonIcon("upload-cloud", "Push to HackMD", () => {
			void this.pushCurrentNote();
		});

		// Command: push
		this.addCommand({
			id: "push-to-hackmd",
			name: "Push current note to HackMD",
			callback: () => { void this.pushCurrentNote(); },
		});

		// Command: copy link
		this.addCommand({
			id: "copy-hackmd-link",
			name: "Copy HackMD link",
			callback: () => { this.copyLink(); },
		});

		// Command: open in browser
		this.addCommand({
			id: "open-in-hackmd",
			name: "Open in HackMD",
			callback: () => { this.openInBrowser(); },
		});

		// Command: unlink
		this.addCommand({
			id: "unlink-hackmd",
			name: "Unlink from HackMD",
			callback: () => { void this.unlinkNote(); },
		});

		// Settings tab
		this.addSettingTab(new HackMDPushSettingTab(this.app, this));
	}

	async loadSettings() {
		const loaded: unknown = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded as Partial<HackMDPushSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// ── Push ──────────────────────────────────────

	private async pushCurrentNote() {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			new Notice("請先打開一篇 Markdown 筆記");
			return;
		}

		if (!this.settings.token) {
			new Notice("請先在設定頁貼上 HackMD API Token");
			const setting = (this.app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } }).setting;
			setting.open();
			setting.openTabById(this.manifest.id);
			return;
		}

		const client = new HackMDClient(this.settings.token);
		const meta = readHackMDMeta(this.app, file);
		const content = await this.getContentForUpload(file);
		const title = this.getNoteTitle(file);
		const tags = this.getNoteTags(file);

		try {
			if (meta["hackmd-id"]) {
				await this.updateExistingNote(client, file, meta["hackmd-id"], content, title, tags);
			} else {
				await this.createNewNote(client, file, title, content, tags);
			}
		} catch (e: unknown) {
			this.handleError(e);
		}
	}

	private async createNewNote(
		client: HackMDClient,
		file: TFile,
		title: string,
		content: string,
		tags: string[]
	) {
		new Notice("正在上傳至 HackMD…");

		const note = await client.createNote({
			title,
			content,
			tags,
			readPermission: this.settings.defaultReadPermission,
			writePermission: this.settings.defaultWritePermission,
			commentPermission: this.settings.defaultCommentPermission,
		});

		await writeHackMDMeta(this.app, file, {
			id: note.id,
			url: note.publishLink,
		});

		new Notice("已建立 HackMD 筆記 ✓");

		if (this.settings.openBrowserAfterPush) {
			window.open(note.publishLink);
		}
	}

	private async updateExistingNote(
		client: HackMDClient,
		file: TFile,
		noteId: string,
		content: string,
		title: string,
		tags: string[]
	) {
		// Check if remote note still exists
		const exists = await client.noteExists(noteId);
		if (!exists) {
			const proceed = await this.confirmRecreate();
			if (!proceed) return;
			// Unlink and create fresh
			await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
				delete fm["hackmd-id"];
				delete fm["hackmd-url"];
				delete fm["hackmd-pushed-at"];
			});
			await this.createNewNote(new HackMDClient(this.settings.token), file, title, content, tags);
			return;
		}

		new Notice("正在更新 HackMD 筆記…");
		await client.updateNote(noteId, { content, title, tags });

		// Update pushed-at timestamp
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm["hackmd-pushed-at"] = new Date().toISOString();
		});

		new Notice("已更新 HackMD 筆記 ✓");

		if (this.settings.openBrowserAfterPush) {
			const updatedMeta = readHackMDMeta(this.app, file);
			if (updatedMeta["hackmd-url"]) window.open(updatedMeta["hackmd-url"]);
		}
	}

	// ── Content preparation ────────────────────────

	private async getContentForUpload(file: TFile): Promise<string> {
		let content = await this.app.vault.read(file);

		// Normalize line endings first — files saved with CRLF (common on
		// Windows) would otherwise not match the frontmatter pattern below,
		// leaving the raw YAML block in the uploaded content.
		content = content.replace(/\r\n?/g, "\n");

		// Strip frontmatter. The inner group is optional so an empty
		// frontmatter block (---\n---\n) is also handled correctly.
		content = content.replace(/^---\n([\s\S]*?)\n?---\n?/, "");

		return content.trim();
	}

	private getNoteTitle(file: TFile): string {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm: Record<string, unknown> | undefined = cache?.frontmatter;
		const fmTitle: unknown = fm?.["title"];
		if (fmTitle && typeof fmTitle === "string") return fmTitle;
		return file.basename;
	}

	private getNoteTags(file: TFile): string[] {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm: Record<string, unknown> | undefined = cache?.frontmatter;
		const fmTags: unknown = fm?.["tags"];
		if (!fmTags) return [];

		if (typeof fmTags === "string") return [fmTags];
		if (Array.isArray(fmTags)) return fmTags.map(String).filter(Boolean);
		return [];
	}

	// ── Auxiliary commands ──────────────────────────

	private copyLink() {
		const file = this.app.workspace.getActiveFile();
		if (!file) return;
		const meta = readHackMDMeta(this.app, file);
		if (!meta["hackmd-url"]) {
			new Notice("此筆記尚未上傳至 HackMD");
			return;
		}
		void navigator.clipboard.writeText(meta["hackmd-url"]);
		new Notice("HackMD 連結已複製 ✓");
	}

	private openInBrowser() {
		const file = this.app.workspace.getActiveFile();
		if (!file) return;
		const meta = readHackMDMeta(this.app, file);
		if (!meta["hackmd-url"]) {
			new Notice("此筆記尚未上傳至 HackMD");
			return;
		}
		window.open(meta["hackmd-url"]);
	}

	private async unlinkNote() {
		const file = this.app.workspace.getActiveFile();
		if (!file) return;
		const meta = readHackMDMeta(this.app, file);
		if (!meta["hackmd-id"]) {
			new Notice("此筆記未連結 HackMD");
			return;
		}
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			delete fm["hackmd-id"];
			delete fm["hackmd-url"];
			delete fm["hackmd-pushed-at"];
		});
		new Notice("已解除 HackMD 連結（遠端筆記不受影響）");
	}

	// ── Helpers ────────────────────────────────────

	private handleError(e: unknown) {
		if (e instanceof HackMDError) {
			new Notice(`HackMD 錯誤 (${e.status})：${e.message}`);
			if (e.status === 401) {
				const setting = (this.app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } }).setting;
				setting.open();
				setting.openTabById(this.manifest.id);
			}
		} else {
			new Notice("HackMD 連線失敗，請檢查網路");
			if (e instanceof Error) {
				console.error("[HackMD Push]", e.message);
			}
		}
	}

	private confirmRecreate(): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmModal(this.app, resolve);
			modal.open();
		});
	}
}

class ConfirmModal extends Modal {
	private resolve: (value: boolean) => void;

	constructor(app: import("obsidian").App, resolve: (value: boolean) => void) {
		super(app);
		this.resolve = resolve;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("p", { text: "遠端筆記已刪除。要重新建立嗎？" });
		const btnRow = contentEl.createEl("div", { cls: "modal-button-container" });
		const confirmBtn = btnRow.createEl("button", { text: "重新建立", cls: "mod-cta" });
		confirmBtn.onclick = () => {
			this.resolve(true);
			this.close();
		};
		const cancelBtn = btnRow.createEl("button", { text: "取消" });
		cancelBtn.onclick = () => {
			this.resolve(false);
			this.close();
		};
	}

	onClose() {
		this.contentEl.empty();
	}
}
