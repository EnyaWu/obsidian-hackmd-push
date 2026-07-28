# 發布指南：GitHub + Obsidian 社群插件庫

## 一、上傳到 GitHub

### 1. 建立 repository

在 GitHub 建立新的 public repo，名稱建議用 `obsidian-hackmd-push`（與 manifest.json 的 `id` 一致）。

### 2. 初始化並推上去

```bash
cd obsidian-hackmd-push

git init
git add .
git commit -m "feat: initial release v0.1.0"

git remote add origin https://github.com/your-username/obsidian-hackmd-push.git
git branch -M main
git push -u origin main
```

### 3. 建立 `.gitignore`

```
node_modules/
*.js.map
```

> `main.js` **要納入 git**（Obsidian 社群要求 Release 包含編譯後的成品）。

### 4. 建立第一個 Release

社群插件庫要求透過 GitHub Release 分發，不接受直接連到原始碼。

```bash
# 確認版本號與 manifest.json 一致
# manifest.json 的 version 欄位填 "0.1.0"

git tag 0.1.0
git push origin 0.1.0
```

然後到 GitHub → Releases → **Draft a new release**：

| 欄位 | 填寫 |
|---|---|
| Tag | `0.1.0` |
| Release title | `0.1.0` |
| Description | 列出本版本的功能（見下方範本） |
| Assets | 上傳 `main.js`、`manifest.json`、`styles.css`（若有） |

Release 說明範本：
```
## HackMD Push 0.1.0

### Features
- One-click push current note to HackMD
- Auto create or update remote note based on frontmatter `hackmd-id`
- Sync title and tags from frontmatter
- Auxiliary commands: copy link, open in browser, unlink note
- Settings page with token verification
```

> **不要**把 `node_modules/` 或整個 zip 上傳到 Assets，社群只需要三個檔案。

### 5. 推薦加入 GitHub Actions（自動化 Release）

在 `.github/workflows/release.yml` 建立以下 workflow，往後只要 push tag 就會自動產生 Release：

```yaml
name: Release

on:
  push:
    tags:
      - "*"

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install and build
        run: |
          npm install
          npm run build

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            main.js
            manifest.json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

往後發版流程只需要：

```bash
# 更新 manifest.json 和 package.json 的 version
git add .
git commit -m "chore: bump version to 0.2.0"
git tag 0.2.0
git push origin main --tags
```

---

## 二、提交到 Obsidian 社群插件庫

官方流程是對 [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases) 發 Pull Request。

### 前置條件確認

在提交前，官方會自動檢查以下項目，先自行確認：

- [ ] `manifest.json` 的 `id` 全小寫、用 `-` 連接，與 repo 名稱一致
- [ ] `manifest.json` 有 `name`、`version`、`minAppVersion`、`description`、`author` 欄位
- [ ] GitHub 上有對應 tag 的 Release，且 Release Assets 包含 `main.js` 和 `manifest.json`
- [ ] repo 是 public
- [ ] 有 `README.md`（說明安裝與使用方式）
- [ ] 有 `LICENSE` 檔（MIT 或其他開源授權）
- [ ] 插件不違反 [Obsidian 開發者政策](https://docs.obsidian.md/Developer+policies)

### 建立 `LICENSE` 檔

```bash
# 在 repo 根目錄建立 MIT license
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2025 Enya

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

### 提交 PR

1. Fork [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases)

2. 編輯 `community-plugins.json`，在陣列末尾加入：

```json
{
  "id": "hackmd-push",
  "name": "HackMD Push",
  "author": "Enya",
  "description": "One-click push your notes to HackMD.",
  "repo": "your-username/obsidian-hackmd-push"
}
```

3. 發 Pull Request，標題格式：`Add plugin: HackMD Push`

4. PR 說明需包含：
   - 插件功能簡介
   - 驗證步驟（說明給 reviewer 看怎麼測試）

### 審核流程

- 官方機器人會自動跑 manifest 格式檢查
- 人工 review 通常需要 **數週到數個月**，視排隊狀況而定
- Review 期間可能被要求修改 README、補充說明、調整程式碼
- 通過後插件會出現在 Obsidian 的社群插件瀏覽器

### 等待期間

審核等待期間，可以透過以下方式讓使用者先安裝：

1. **手動安裝**：提供 Release 的 zip 下載，讓用戶手動放到 plugins 資料夾（現行方式）
2. **BRAT 插件**：讓用戶透過 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 安裝 beta 插件，只需要提供 GitHub repo 的 URL

BRAT 安裝方式（可加到 README）：
```
1. 安裝 BRAT 插件
2. BRAT 設定 → Add Beta Plugin
3. 貼上：https://github.com/your-username/obsidian-hackmd-push
```

---

## 版本號規範

遵循 [Semantic Versioning](https://semver.org/)：

| 情況 | 版本升級 | 範例 |
|---|---|---|
| Bug 修正 | patch | 0.1.0 → 0.1.1 |
| 新功能（向下相容） | minor | 0.1.0 → 0.2.0 |
| 破壞性變更 | major | 0.1.0 → 1.0.0 |

每次發版需要同時更新：
- `manifest.json` 的 `version`
- `package.json` 的 `version`
