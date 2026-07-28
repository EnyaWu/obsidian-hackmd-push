# HackMD Push

One-click push your Obsidian notes to [HackMD](https://hackmd.io).

## Features

- **Push** the current note to HackMD with a single command or ribbon click
- **Create or update** — the plugin remembers the remote note ID and syncs to the same note on subsequent pushes
- **Title & tags** synced automatically from frontmatter
- **Frontmatter stripped** before upload so HackMD shows clean content
- Auxiliary commands: copy link, open in browser, unlink note

## Installation

### Manual (current)

1. Download the latest `obsidian-hackmd-push.zip` from [Releases](../../releases)
2. Unzip and place the `obsidian-hackmd-push` folder into your vault's `.obsidian/plugins/` directory
3. In Obsidian: **Settings → Community plugins → Enable** HackMD Push

Only `main.js` and `manifest.json` are required to run the plugin.

### Via Community Plugin Browser (coming soon)

Search for **HackMD Push** once it is listed in the official directory.

## Setup

1. Open **Settings → HackMD Push**
2. Click **① 開啟 HackMD 設定頁** to open `hackmd.io/settings#api` in your browser (you must be logged in)
3. Create a new API token on that page
4. Paste the token into **② 貼上 Token**
5. Click **③ 驗證** — you should see your HackMD username appear

## Usage

With any Markdown note open:

| Action | How |
|---|---|
| Push to HackMD | Command palette → `Push current note to HackMD`, or click the cloud icon in the ribbon |
| Copy link | Command palette → `Copy HackMD link` |
| Open in browser | Command palette → `Open in HackMD` |
| Unlink note | Command palette → `Unlink from HackMD` |

On first push the plugin creates a new HackMD note and writes three fields into your frontmatter:

```yaml
hackmd-id: <note id>
hackmd-url: https://hackmd.io/@you/your-note
hackmd-pushed-at: 2025-01-01T00:00:00.000Z
```

Subsequent pushes update the same remote note.

## Frontmatter integration

The plugin reads the following frontmatter fields before uploading:

```yaml
title: My Note Title     # used as the HackMD note title; falls back to filename
tags: [CISSP, security]  # synced to HackMD tags; string or array both accepted
```

The frontmatter block itself is stripped from the uploaded content.

## Default permissions

| Permission | Default |
|---|---|
| Read | Everyone (`guest`) |
| Write | Signed-in users |
| Comment | Disabled |

All three can be changed in Settings.

## Security note

Your API token is stored in plain text at `.obsidian/plugins/hackmd-push/data.json`. If your vault is synced via iCloud, Obsidian Sync, or Git, the token travels with it. Treat it like a password and regenerate it if you suspect exposure.

## Known limitations

- Local attachments (`![[image.png]]`) are not uploaded — HackMD cannot access files on your machine
- Wikilinks (`[[note]]`) are not converted — they appear as plain text on HackMD
- Sync is one-way: Obsidian → HackMD. Edits made on HackMD will be overwritten on next push
- Obsidian callouts (`> [!note]`) are not converted to HackMD container syntax

## Development

```bash
git clone https://github.com/EnyaWu/obsidian-hackmd-push
cd obsidian-hackmd-push
npm install

# watch mode (symlink main.js into your vault's plugin folder for live reload)
npm run dev

# production build
npm run build
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed breakdown of every source file.

## License

MIT
