import { requestUrl, RequestUrlParam } from "obsidian";

const BASE_URL = "https://api.hackmd.io/v1";

export interface HackMDUser {
	id: string;
	name: string;
	email: string | null;
	userPath: string;
}

export type ReadPermission = "owner" | "signed_in" | "guest";
export type WritePermission = "owner" | "signed_in" | "guest";
export type CommentPermission = "disabled" | "forbidden" | "owners" | "signed_in_users" | "everyone";

export interface CreateNoteOptions {
	title?: string;
	content: string;
	tags?: string[];
	readPermission?: ReadPermission;
	writePermission?: WritePermission;
	commentPermission?: CommentPermission;
}

export interface UpdateNoteOptions {
	content: string;
	title?: string;
	tags?: string[];
}

export interface HackMDNote {
	id: string;
	title: string;
	publishLink: string;
}

export class HackMDClient {
	constructor(private token: string) {}

	private async request(
		method: string,
		path: string,
		body?: Record<string, unknown>
	): Promise<{ status: number; json: unknown }> {
		const params: RequestUrlParam = {
			url: `${BASE_URL}${path}`,
			method,
			headers: {
				Authorization: `Bearer ${this.token}`,
				"Content-Type": "application/json",
			},
			throw: false,
		};

		if (body) {
			params.body = JSON.stringify(body);
		}

		const resp = await requestUrl(params);
		let json: unknown = null;
		try {
			json = resp.json as unknown;
		} catch {
			// Empty body (e.g. 202 Accepted from PATCH) — not an error
		}
		return { status: resp.status, json };
	}

	/** Verify token & return user info */
	async getMe(): Promise<HackMDUser> {
		const { status, json } = await this.request("GET", "/me");
		if (status === 401) throw new HackMDError(401, "Token 無效或已過期");
		if (status !== 200) throw new HackMDError(status, "無法取得用戶資訊");
		return json as HackMDUser;
	}

	/** Create a new note */
	async createNote(opts: CreateNoteOptions): Promise<HackMDNote> {
		const { status, json } = await this.request("POST", "/notes", {
			title: opts.title,
			content: opts.content,
			tags: opts.tags ?? [],
			readPermission: opts.readPermission ?? "guest",
			writePermission: opts.writePermission ?? "signed_in",
			commentPermission: opts.commentPermission ?? "disabled",
		});
		if (status === 401) throw new HackMDError(401, "Token 無效或已過期");
		if (status === 429) throw new HackMDError(429, "API 呼叫頻率超過限制，請稍後再試");
		if (status !== 201) throw new HackMDError(status, "建立筆記失敗");
		return json as HackMDNote;
	}

	/** Update an existing note's tags first (if any), then content and title
	 *  in a separate call. HackMD's PATCH endpoint has been observed to
	 *  silently wipe the note content whenever a `tags`-only request is sent
	 *  — even as an isolated call, regardless of what preceded it. Sending
	 *  the content/title update *after* the tags update overwrites that
	 *  wipe, so tags must go first. */
	async updateNote(noteId: string, opts: UpdateNoteOptions): Promise<void> {
		if (opts.tags !== undefined && opts.tags.length > 0) {
			const tagsResp = await this.request("PATCH", `/notes/${noteId}`, { tags: opts.tags });
			// Tags are best-effort: don't fail the whole push if only this part errors
			if (tagsResp.status !== 202) {
				console.error("[HackMD Push] Failed to update tags, status:", tagsResp.status);
			}
		}

		const body: Record<string, unknown> = { content: opts.content };
		if (opts.title !== undefined) body.title = opts.title;

		const { status } = await this.request("PATCH", `/notes/${noteId}`, body);
		if (status === 401) throw new HackMDError(401, "Token 無效或已過期");
		if (status === 403) throw new HackMDError(403, "無權限更新此筆記");
		if (status === 404) throw new HackMDError(404, "遠端筆記不存在");
		if (status === 429) throw new HackMDError(429, "API 呼叫頻率超過限制，請稍後再試");
		if (status !== 202) throw new HackMDError(status, "更新筆記失敗");
	}

	/** Check if a note still exists */
	async noteExists(noteId: string): Promise<boolean> {
		const { status } = await this.request("GET", `/notes/${noteId}`);
		return status === 200;
	}
}

export class HackMDError extends Error {
	constructor(public status: number, message: string) {
		super(message);
		this.name = "HackMDError";
	}
}
