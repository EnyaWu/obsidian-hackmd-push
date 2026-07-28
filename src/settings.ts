import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type HackMDPushPlugin from "./main";
import { HackMDClient, HackMDError, ReadPermission, WritePermission, CommentPermission } from "./hackmd-client";

export interface HackMDPushSettings {
	token: string;
	verifiedUserName: string;
	defaultReadPermission: ReadPermission;
	defaultWritePermission: WritePermission;
	defaultCommentPermission: CommentPermission;
	openBrowserAfterPush: boolean;
}

export const DEFAULT_SETTINGS: HackMDPushSettings = {
	token: "",
	verifiedUserName: "",
	defaultReadPermission: "guest",
	defaultWritePermission: "signed_in",
	defaultCommentPermission: "disabled",
	openBrowserAfterPush: false,
};

export class HackMDPushSettingTab extends PluginSettingTab {
	plugin: HackMDPushPlugin;

	constructor(app: App, plugin: HackMDPushPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Token section ──────────────────────────────

		new Setting(containerEl).setName("HackMD 連線").setHeading();

		// Step 1: open browser
		new Setting(containerEl)
			.setName("① 取得 API Token")
			.setDesc("在瀏覽器中登入 HackMD，到設定頁建立一組 Token。")
			.addButton((btn) =>
				btn.setButtonText("開啟 HackMD 設定頁").onClick(() => {
					window.open("https://hackmd.io/settings#api");
				})
			);

		// Step 2: paste token
		const tokenSetting = new Setting(containerEl)
			.setName("② 貼上 Token")
			.setDesc(this.tokenStatusDesc());

		tokenSetting.addText((text) =>
			text
				.setPlaceholder("貼上你的 HackMD API Token")
				.setValue(this.plugin.settings.token)
				.then((t) => {
					t.inputEl.type = "password";
					t.inputEl.setCssProps({ "--input-width": "300px" });
				})
				.onChange(async (value) => {
					this.plugin.settings.token = value.trim();
					this.plugin.settings.verifiedUserName = "";
					await this.plugin.saveSettings();
					tokenSetting.setDesc(this.tokenStatusDesc());
				})
		);

		// Step 3: verify
		new Setting(containerEl)
			.setName("③ 驗證連線")
			.addButton((btn) =>
				btn
					.setButtonText("驗證")
					.setCta()
					.onClick(async () => {
						if (!this.plugin.settings.token) {
							new Notice("請先貼上 Token");
							return;
						}
						btn.setButtonText("驗證中…");
						btn.setDisabled(true);
						try {
							const client = new HackMDClient(this.plugin.settings.token);
							const user = await client.getMe();
							this.plugin.settings.verifiedUserName = user.name;
							await this.plugin.saveSettings();
							new Notice(`已連結：${user.name}`);
						} catch (e: unknown) {
							this.plugin.settings.verifiedUserName = "";
							await this.plugin.saveSettings();
							if (e instanceof HackMDError) {
								new Notice(`驗證失敗：${e.message}`);
							} else {
								new Notice("驗證失敗：網路錯誤");
							}
						}
						btn.setButtonText("驗證");
						btn.setDisabled(false);
						tokenSetting.setDesc(this.tokenStatusDesc());
					})
			);

		// ── Permission defaults ──────────────────────────

		new Setting(containerEl).setName("預設權限").setHeading();

		new Setting(containerEl)
			.setName("閱讀權限")
			.addDropdown((dd) =>
				dd
					.addOptions({
						owner: "僅擁有者",
						signed_in: "已登入用戶",
						guest: "所有人",
					})
					.setValue(this.plugin.settings.defaultReadPermission)
					.onChange(async (v) => {
						this.plugin.settings.defaultReadPermission = v as ReadPermission;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("編輯權限")
			.addDropdown((dd) =>
				dd
					.addOptions({
						owner: "僅擁有者",
						signed_in: "已登入用戶",
						guest: "所有人",
					})
					.setValue(this.plugin.settings.defaultWritePermission)
					.onChange(async (v) => {
						this.plugin.settings.defaultWritePermission = v as WritePermission;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("留言權限")
			.addDropdown((dd) =>
				dd
					.addOptions({
						disabled: "關閉",
						forbidden: "禁止",
						owners: "僅擁有者",
						signed_in_users: "已登入用戶",
						everyone: "所有人",
					})
					.setValue(this.plugin.settings.defaultCommentPermission)
					.onChange(async (v) => {
						this.plugin.settings.defaultCommentPermission = v as CommentPermission;
						await this.plugin.saveSettings();
					})
			);

		// ── Behavior ──────────────────────────

		new Setting(containerEl).setName("行為").setHeading();

		new Setting(containerEl)
			.setName("上傳後開啟瀏覽器")
			.setDesc("Push 成功後自動在瀏覽器中打開 HackMD 筆記。")
			.addToggle((t) =>
				t
					.setValue(this.plugin.settings.openBrowserAfterPush)
					.onChange(async (v) => {
						this.plugin.settings.openBrowserAfterPush = v;
						await this.plugin.saveSettings();
					})
			);
	}

	private tokenStatusDesc(): string {
		if (!this.plugin.settings.token) return "尚未設定 Token。";
		if (this.plugin.settings.verifiedUserName)
			return `✅ 已連結：${this.plugin.settings.verifiedUserName}`;
		return "Token 已輸入，尚未驗證。";
	}
}
