import { App, TFile } from "obsidian";

export interface HackMDFrontmatter {
	"hackmd-id"?: string;
	"hackmd-url"?: string;
	"hackmd-pushed-at"?: string;
}

/** Read hackmd-related fields from frontmatter */
export function readHackMDMeta(app: App, file: TFile): HackMDFrontmatter {
	const cache = app.metadataCache.getFileCache(file);
	const fm = cache?.frontmatter;
	if (!fm) return {};
	return {
		"hackmd-id": fm["hackmd-id"],
		"hackmd-url": fm["hackmd-url"],
		"hackmd-pushed-at": fm["hackmd-pushed-at"],
	};
}

/** Write hackmd-id, hackmd-url, hackmd-pushed-at into frontmatter */
export async function writeHackMDMeta(
	app: App,
	file: TFile,
	meta: { id: string; url: string }
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm) => {
		fm["hackmd-id"] = meta.id;
		fm["hackmd-url"] = meta.url;
		fm["hackmd-pushed-at"] = new Date().toISOString();
	});
}
