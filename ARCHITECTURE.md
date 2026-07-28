# HackMD Push — 程式架構說明

## 目錄結構

```
obsidian-hackmd-push/
├── manifest.json          # 插件元資料（id、名稱、最低 Obsidian 版本）
├── package.json           # 開發依賴與 build script
├── tsconfig.json          # TypeScript 編譯設定
├── esbuild.config.mjs     # 打包設定（開發 watch / 正式 build）
├── main.js                # 編譯後的插件本體（Obsidian 實際載入此檔）
└── src/
    ├── main.ts            # 插件進入點：指令、ribbon、生命週期
    ├── settings.ts        # 設定頁 UI 與設定資料型別
    ├── hackmd-client.ts   # HackMD REST API 封裝
    └── frontmatter.ts     # Obsidian frontmatter 讀寫工具
```

---

## 各檔案說明

### `manifest.json`

Obsidian 識別插件用的元資料。重要欄位：

| 欄位 | 值 | 說明 |
|---|---|---|
| `id` | `hackmd-push` | 插件唯一識別碼，也用於設定頁的 `openTabById` |
| `minAppVersion` | `1.4.0` | 需要此版本才有 `processFrontMatter` API |
| `isDesktopOnly` | `false` | 行動版也能啟用（但 `window.open` 行為因平台而異） |

---

### `src/hackmd-client.ts`

HackMD REST API 的封裝層，與 Obsidian 框架完全解耦，只依賴 `requestUrl`。

#### 設計決策

- 使用 Obsidian 的 `requestUrl` 而非原生 `fetch`，以繞過 Electron 的 CORS 限制。
- 所有請求都帶 `throw: false`，由方法內部根據 HTTP status code 拋出語意明確的 `HackMDError`，避免呼叫端處理原始 HTTP 細節。

#### 型別定義

```typescript
type ReadPermission    = "owner" | "signed_in" | "guest"
type WritePermission   = "owner" | "signed_in" | "guest"
type CommentPermission = "disabled" | "forbidden" | "owners" | "signed_in_users" | "everyone"
```

#### 公開方法

| 方法 | HTTP | 說明 |
|---|---|---|
| `getMe()` | `GET /v1/me` | 驗證 token，回傳用戶資訊（`id`, `name`, `email`）|
| `createNote(opts)` | `POST /v1/notes` | 建立新筆記，回傳 `{ id, title, publishLink }` |
| `updateNote(id, opts)` | `PATCH /v1/notes/:id` | 更新 content、title、tags |
| `noteExists(id)` | `GET /v1/notes/:id` | 確認遠端筆記是否存在（只看 status code）|

#### 錯誤處理

每個方法會將特定 HTTP status 轉換為帶語意的 `HackMDError`：

```
401 → Token 無效或已過期
403 → 無權限更新此筆記
404 → 遠端筆記不存在
429 → API 頻率限制
其他 → 通用錯誤訊息
```

---

### `src/frontmatter.ts`

負責讀寫 Obsidian 筆記的 frontmatter，用來維護本地筆記與 HackMD 筆記的關聯。

#### 寫入的欄位

上傳成功後，插件會在 frontmatter 寫入三個欄位：

```yaml
hackmd-id: ehgwc6a8RXSmcSaRwIQ2jw      # HackMD 的 note ID，update 時用來定位遠端筆記
hackmd-url: https://hackmd.io/@user/... # 可分享的完整連結
hackmd-pushed-at: 2025-01-01T00:00:00Z  # 最後一次 push 的時間戳（ISO 8601）
```

#### 函式

- `readHackMDMeta(app, file)` — 從 metadata cache 讀取上述三欄，回傳 `HackMDFrontmatter` 物件。使用 cache 而非直接讀檔，效能較佳。
- `writeHackMDMeta(app, file, { id, url })` — 透過 `processFrontMatter` 寫入，Obsidian 會自動處理 frontmatter 的解析與序列化，不需要手動操作 YAML。

---

### `src/settings.ts`

設定頁 UI（`PluginSettingTab`）與設定資料的型別定義。

#### `HackMDPushSettings` 型別

| 欄位 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `token` | `string` | `""` | HackMD API Token（明文存於 plugin data） |
| `verifiedUserName` | `string` | `""` | 驗證成功後的用戶名，純顯示用 |
| `defaultReadPermission` | `ReadPermission` | `"guest"` | 新建筆記的閱讀權限 |
| `defaultWritePermission` | `WritePermission` | `"signed_in"` | 新建筆記的編輯權限 |
| `defaultCommentPermission` | `CommentPermission` | `"disabled"` | 新建筆記的留言權限 |
| `openBrowserAfterPush` | `boolean` | `false` | Push 後自動開啟瀏覽器 |

> **注意**：Token 以明文儲存在 `.obsidian/plugins/hackmd-push/data.json`。若 vault 有啟用雲端同步（iCloud、Obsidian Sync、Git），token 會隨之同步到其他裝置，請自行評估安全性。

#### 設定頁 UI 流程（三步驟）

```
① 「開啟 HackMD 設定頁」按鈕
   → window.open('https://hackmd.io/settings#api')
   → 用戶在已登入的瀏覽器中建立 Token

② Token 輸入框（type=password 遮蔽顯示）
   → onChange 時立即儲存，並清除 verifiedUserName

③ 「驗證」按鈕
   → 呼叫 getMe()
   → 成功：寫入 verifiedUserName，Notice 顯示「已連結：{name}」
   → 失敗：清除 verifiedUserName，Notice 顯示錯誤原因
```

---

### `src/main.ts`

插件進入點，繼承 Obsidian 的 `Plugin` 類別。

#### 生命週期

- `onload()` — 載入設定、註冊 ribbon icon、註冊四個指令、掛載設定頁。
- 無 `onunload()`——插件沒有需要手動清理的資源（listener 由 Obsidian 自動清理）。

#### 四個指令

| 指令 ID | 名稱 | 說明 |
|---|---|---|
| `push-to-hackmd` | Push current note to HackMD | 主要功能，見下方流程 |
| `copy-hackmd-link` | Copy HackMD link | 複製 `hackmd-url` 到剪貼簿 |
| `open-in-hackmd` | Open in HackMD | 在瀏覽器開啟 `hackmd-url` |
| `unlink-hackmd` | Unlink from HackMD | 刪除 frontmatter 中三個 hackmd 欄位（不刪除遠端筆記） |

#### Push 流程

```
pushCurrentNote()
├── 確認當前檔案是 .md
├── 確認 token 已設定（否則開設定頁）
├── 讀取 frontmatter 的 hackmd-id
├── 讀取筆記內容，剝除 frontmatter
├── 讀取標題（frontmatter.title > 檔名）
├── 讀取 tags（frontmatter.tags，支援字串或陣列格式）
│
├── [無 hackmd-id] createNewNote()
│   ├── POST /v1/notes（帶 title, content, tags, permissions）
│   ├── 寫回 hackmd-id、hackmd-url、hackmd-pushed-at
│   └── （選用）開啟瀏覽器
│
└── [有 hackmd-id] updateExistingNote()
    ├── GET /v1/notes/:id 確認遠端存在
    ├── [404] confirmRecreate() 彈出確認框
    │   ├── 確認 → 清除 frontmatter 關聯 → 走 createNewNote()
    │   └── 取消 → 結束
    ├── PATCH /v1/notes/:id（帶 content, title, tags）
    ├── 更新 hackmd-pushed-at
    └── （選用）開啟瀏覽器
```

#### 內容前處理

上傳前 `getContentForUpload()` 會做兩件事：

1. **剝除 frontmatter**：用正則 `/^---\n[\s\S]*?\n---\n?/` 移除開頭的 YAML 區塊，避免 HackMD 把 frontmatter 當成內文顯示。
2. **trim()**：移除前後多餘空白行。

#### Tags 解析

`getNoteTags()` 同時支援 Obsidian 的兩種 frontmatter tag 格式：

```yaml
# 格式一：字串
tags: CISSP

# 格式二：陣列
tags: [CISSP, 資安, 考試]
```

#### 錯誤處理

`handleError()` 統一處理 `HackMDError`：
- 401 → Notice + 自動開設定頁重新驗證
- 其他 `HackMDError` → Notice 顯示錯誤碼與訊息
- 非預期錯誤 → Notice + `console.error` 記錄完整錯誤

#### `confirmRecreate()`

當遠端筆記已刪除時，用 `Notice` 元件內嵌兩顆按鈕（「重新建立」、「取消」）實作確認對話框，回傳 `Promise<boolean>`。這是因為 Obsidian 的原生 `Modal` 較重量級，Notice 嵌按鈕是更輕量的做法，但缺點是無法阻止背景操作。

---

## 資料流摘要

```
Obsidian vault (.md file)
    │
    │  vault.read() + metadataCache
    ▼
main.ts（指令處理、流程控制）
    │
    ├──► frontmatter.ts（讀寫 hackmd-id / hackmd-url / hackmd-pushed-at）
    │
    └──► hackmd-client.ts（HTTP 請求）
              │
              │  requestUrl（Obsidian API，繞過 CORS）
              ▼
         api.hackmd.io/v1
```

---

## 已知限制

- **本地附件無法上傳**：Obsidian 的 `![[image.png]]` 參照本機檔案，HackMD 無法存取，目前直接保留原語法（HackMD 端會顯示為損壞圖片）。
- **Wikilink 不轉換**：`[[note]]` 在 HackMD 端會顯示為純文字 `[[note]]`，不會變成連結。
- **單向同步**：只支援 Obsidian → HackMD，在 HackMD 端修改的內容 push 後會被本地版本覆蓋。
- **Callout 不轉換**：Obsidian 的 `> [!note]` 語法與 HackMD 的 `:::info` 語法不互通，目前不做轉換。

以上功能預計在 M3 實作。
