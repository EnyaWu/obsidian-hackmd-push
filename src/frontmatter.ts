import { App, CachedMetadata, TFile } from "obsidian";

export interface HackMDFrontmatter {
	"hackmd-id"?: string;
	"hackmd-url"?: string;
	"hackmd-pushed-at"?: string;
}

/** Read hackmd-related fields from frontmatter */
export function readHackMDMeta(app: App, file: TFile): HackMDFrontmatter {
	const cache: CachedMetadata | null = app.metadataCache.getFileCache(file);
	const fm: Record<string, unknown> | undefined = cache?.frontmatter;
	if (!fm) return {};
	return {
		"hackmd-id": typeof fm["hackmd-id"] === "string" ? fm["hackmd-id"] : undefined,
		"hackmd-url": typeof fm["hackmd-url"] === "string" ? fm["hackmd-url"] : undefined,
		"hackmd-pushed-at": typeof fm["hackmd-pushed-at"] === "string" ? fm["hackmd-pushed-at"] : undefined,
	};
}

/** Write hackmd-id, hackmd-url, hackmd-pushed-at into frontmatter */
export async function writeHackMDMeta(
	app: App,
	file: TFile,
	meta: { id: string; url: string }
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm["hackmd-id"] = meta.id;
		fm["hackmd-url"] = meta.url;
		fm["hackmd-pushed-at"] = new Date().toISOString();
	});
}
