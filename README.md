# WordPressテーマ開発用Gulpビルドシステム

このプロジェクトは、WordPressテーマ開発を効率化するためのGulpベースのビルドシステムです。

## 主な機能

- ✅ **SCSS→CSS変換**: Dart Sass、Autoprefixer、ソースマップ対応
- ✅ **JavaScriptバンドル**: Webpack、Babel、ES Modules対応
- ✅ **HTML/PHP自動フォーマット**: インデント整形、属性追加、エンティティ化
- ✅ **画像最適化**: JPG、PNG、GIF圧縮
- ✅ **WebP変換**: 全画像タイプ（BMP、TIFF含む）の自動WebP変換
- ✅ **UTF-8エンコーディングチェック**: 自動検出と変換
- ✅ **ファイル監視**: 変更を検知して自動ビルド

---

## ⚡ クイックリファレンス（よく使うコマンド）

### 🚀 開発モード（最もよく使う）

```bash
# ファイル監視付きで自動ビルド
gulp
# または
gulp dev
# または
npm run dev
```

### 🖼️ 画像再圧縮コマンド

```bash
# recompress: true のみ再圧縮
gulp imagesRecompress
# または
npm run images:rc

# recompress: false 以外すべて再圧縮
gulp imagesRecompressAll
# または
npm run images:rc-all

# すべての画像を強制再圧縮
gulp imagesRecompressForce
# または
npm run images:rc-force

# 特定ファイルのみ再圧縮
gulp imageFile --file sample.jpg
# または
npm run images:file sample.jpg
```

### ✅ チェックコマンド

```bash
# HTML/PHPのリント（全ファイル）
npm run lint:html

# HTML/PHPのリント（特定ファイル - ファイルパスを指定）
npm run lint:file index.php

# 全ファイルのカスタムチェック
npm run check:all

# 特定ファイルのカスタムチェック（ファイルパスを指定）
npm run check:file index.php

# エンコーディングチェック
gulp checkEncoding
```

**注意**: `lint:file`と`check:file`は、ファイルパスを指定しないと全ファイルチェックになります。

---

## 📋 すべてのコマンド一覧

### 開発・ビルド

```bash
# 開発モード（ファイル監視付き）
gulp
# または
gulp dev
# または
npm run dev

# 本番用ビルド
gulp build
# または
npm run build

# クリーンアップ（生成ファイル削除）
gulp clean
# または
npm run clean
```

### 個別タスク

```bash
# SCSSのみコンパイル
gulp scss
# または
npm run scss

# JavaScriptのみバンドル
gulp js
# または
npm run js

# 画像処理のみ実行
gulp processImages
# または
npm run images
```

### 画像再圧縮コマンド

```bash
# 画像の強制再圧縮（recompress: true のみ対象）
gulp imagesRecompress
# または
npm run images:rc

# 画像の強制再圧縮（recompress: false 以外すべて対象）
gulp imagesRecompressAll
# または
npm run images:rc-all

# 画像の強制再圧縮（recompress: false も含むすべて対象）
gulp imagesRecompressForce
# または
npm run images:rc-force

# 特定ファイルのみ再圧縮
gulp imageFile --file sample.jpg
# または
npm run images:file sample.jpg
```

### チェック・リントコマンド

```bash
# HTML/PHPのリント（全ファイル）
npm run lint:html

# HTML/PHPのリント（特定ファイル - ファイルパスを指定）
npm run lint:file index.php

# 全ファイルのカスタムチェック
npm run check:all

# 特定ファイルのカスタムチェック（ファイルパスを指定）
npm run check:file index.php

# エンコーディングチェック（デフォルトはチェックのみ、自動変換なし）
gulp checkEncoding
```

**注意**: `lint:file`と`check:file`は、ファイルパスを指定しないと全ファイルチェックになります。

### その他のコマンド

```bash
# タスク一覧を確認
gulp --tasks
```

---

## 🚀 初期セットアップ

### 1. パッケージのインストール

```bash
npm install
```

### 2. テーマ名の設定

`gulpfile.mjs`の**54行目**でテーマ名を設定してください：

```javascript
const THEME_NAME = 'portfolio';  // ← あなたのテーマ名に変更
```

### 3. 動作確認

```bash
# 開発モードを起動
gulp dev
# または
npm run dev
```

ファイルを編集すると自動的にビルドが実行されます。

---

## 🎯 使い方

### 開発時の基本的な流れ

1. **開発モードを起動**
   ```bash
   gulp dev
   # または
   npm run dev
   ```

2. **ファイルを編集**
   - `src/scss/` でSCSSファイルを編集 → 自動的にCSSにコンパイル
   - `src/js/` でJavaScriptファイルを編集 → 自動的にバンドル
   - `**/*.php` や `**/*.html` を編集 → 自動的にフォーマット
   - 画像を追加 → 自動的に最適化・WebP変換

3. **ビルド結果を確認**
   - CSS: `wp-content/themes/{テーマ名}/assets/css/main.min.css`
   - JS: `wp-content/themes/{テーマ名}/assets/js/main.min.js`
   - 画像: `wp-content/themes/{テーマ名}/assets/img/` （WebP形式）

### 本番用ビルド

```bash
gulp build
# または
npm run build
```

- すべてのファイルをクリーンアップしてから再ビルド
- 本番環境にデプロイする前に実行することを推奨

---

## ⚙️ プロジェクト設定のカスタマイズ

プロジェクトによって不要な機能がある場合、**`gulpfile.mjs`の57～103行目**にある`PROJECT_SETTINGS`オブジェクトで機能を無効化できます。

### 設定の全体像

```javascript
const PROJECT_SETTINGS = {
    // ===== メイン機能の切り替え =====
    enableScss: true,              // SCSS処理の有効化
    enableJs: true,                // JavaScript処理の有効化
    enableHtmlFormat: true,        // HTML/PHPフォーマット処理の有効化
    enableImageProcessing: true,   // 画像処理の有効化
    
    // ===== 画像処理の詳細設定 =====
    imageProcessing: {
        enableOptimize: true,           // 画像の圧縮最適化
        enableWebpConversion: true,     // WebP変換
        enableBmpTiffConversion: true,  // BMP/TIFF/GIF→PNG変換
        enableCleanOriginal: true       // 元画像の自動削除
    },
    
    // ===== HTML/PHPフォーマットの詳細設定 =====
    htmlFormat: {
        enableImageAttributes: true,      // imgタグへの自動属性追加
        enableEntityEscape: true,         // 特殊文字のHTMLエンティティ化
        enableIndentFormat: true,         // インデント整形
        enableTextNodeCleanup: true,      // テキストノード内の改行削除
        enableTrailingSpaceRemoval: true, // 行末スペース削除
        enableScriptLinkCleanup: true     // script/linkタグのクリーンアップ
    },
    
    // ===== UTF-8エンコーディングチェック =====
    encoding: {
        enableCheck: true,     // エンコーディングチェックの有効化
        autoConvert: false,     // 非UTF-8ファイルを自動的にUTF-8に変換（チェックのみの場合はfalse）
        showWarnings: true,    // 警告メッセージの表示
        excludePatterns: [     // チェック除外パターン
            'node_modules/**',
            '**/vendor/**',
            '**/*.min.js',
            '**/*.min.css'
        ]
    }
};
```

### 設定項目の詳細

#### 1. メイン機能の切り替え

| 設定項目 | 説明 | デフォルト |
|---------|------|-----------|
| `enableScss` | SCSSファイルをCSSにコンパイル | `true` |
| `enableJs` | JavaScriptファイルをWebpackでバンドル | `true` |
| `enableHtmlFormat` | HTML/PHPファイルの自動フォーマット | `true` |
| `enableImageProcessing` | 画像の最適化・変換処理 | `true` |

#### 2. 画像処理の詳細設定

| 設定項目 | 説明 | デフォルト |
|---------|------|-----------|
| `enableOptimize` | JPG、PNG、GIF画像の圧縮最適化 | `true` |
| `enableWebpConversion` | 画像をWebP形式に変換 | `true` |
| `enableBmpTiffConversion` | BMP、TIFF、GIFをPNGに変換 | `true` |
| `enableCleanOriginal` | WebP変換成功後、元画像を自動削除 | `true` |

#### 3. HTML/PHPフォーマットの詳細設定

| 設定項目 | 説明 | デフォルト |
|---------|------|-----------|
| `enableImageAttributes` | `<img>`タグに`width`、`height`、`alt`、`loading`属性を自動追加 | `true` |
| `enableEntityEscape` | `©`、`®`、`™`などの特殊文字をHTMLエンティティに変換 | `true` |
| `enableIndentFormat` | HTMLのインデントを2スペースで整形 | `true` |
| `enableTextNodeCleanup` | タグ内のテキストの不要な改行を削除 | `true` |
| `enableTrailingSpaceRemoval` | 行末の半角スペースを削除 | `true` |
| `enableScriptLinkCleanup` | `<script>`と`<link>`タグから不要な属性を削除 | `true` |

#### 4. UTF-8エンコーディングチェック

| 設定項目 | 説明 | デフォルト |
|---------|------|-----------|
| `enableCheck` | ファイルのエンコーディングをチェック | `true` |
| `autoConvert` | 非UTF-8ファイルを自動的にUTF-8に変換 | `false`（チェックのみ） |
| `showWarnings` | エンコーディングエラー時に警告を表示 | `true` |
| `excludePatterns` | チェック対象から除外するファイルパターン | `['node_modules/**', ...]` |

### よくある設定例

#### 例1: 画像処理を完全に無効化

```javascript
const PROJECT_SETTINGS = {
    enableScss: true,
    enableJs: true,
    enableHtmlFormat: true,
    enableImageProcessing: false,  // ← 画像処理をすべて無効化
    // ...
};
```

#### 例2: WebP変換のみを無効化（元画像を残す）

```javascript
imageProcessing: {
    enableOptimize: true,
    enableWebpConversion: false,  // ← WebP変換のみ無効
    enableBmpTiffConversion: true,
    enableCleanOriginal: false    // ← 元画像を削除しない
}
```

#### 例3: HTML整形のみを有効化（他は無効）

```javascript
const PROJECT_SETTINGS = {
    enableScss: false,           // ← SCSS処理を無効
    enableJs: false,             // ← JavaScript処理を無効
    enableHtmlFormat: true,      // ← HTML処理のみ有効
    enableImageProcessing: false, // ← 画像処理を無効
    // ...
};
```

#### 例4: エンコーディングチェックで自動変換を有効化

```javascript
encoding: {
    enableCheck: true,
    autoConvert: true,  // ← 自動変換を有効化（デフォルトはfalse）
    showWarnings: true,
    excludePatterns: [
        'node_modules/**',
        '**/vendor/**',
        '**/*.min.js',
        '**/*.min.css'
    ]
}
```

**注意**: デフォルトでは`autoConvert: false`（チェックのみ）です。自動変換が必要な場合のみ`true`に設定してください。

### 設定時の注意事項

- **画像ファイルは自動的に除外**：エンコーディングチェックは画像ファイル（JPG、PNG、GIF、WebP、BMP、TIFF、SVG、ICO）を自動的にスキップします
- **元画像の自動削除**：`enableCleanOriginal: true`の場合、WebP変換が成功した元画像ファイルが**自動的に削除**されます
- **BMP/TIFF/GIF変換**：WebP変換を有効にする場合は、`enableBmpTiffConversion: true`を推奨

---

## 🌐 UTF-8エンコーディングチェック

プロジェクト内のすべてのソースファイル（JS、JSX、TS、TSX、PHP、HTML、CSS、SCSS）のエンコーディングをチェックし、UTF-8以外のエンコーディングを検出します。デフォルトではチェックのみを行い、自動変換は行いません。

### 使い方

```bash
# 全ファイルのエンコーディングをチェック・変換
gulp checkEncoding
```

### 機能

- **自動検出**: Shift_JIS、EUC-JP、ISO-8859-1、ASCII（UTF-8として正しくデコードできない場合）などの非UTF-8エンコーディングを自動検出
- **チェックのみ**: デフォルトではエンコーディングをチェックし、エラーとして表示するのみ（自動変換は行わない）
- **自動変換オプション**: `autoConvert: true`に設定することで、検出されたファイルを自動的にUTF-8に変換可能
- **画像ファイル除外**: 画像ファイルは自動的にスキップ
- **除外パターン**: `node_modules`やビルド済みファイルを自動的に除外

### 実行例

**チェックのみ（デフォルト）**:
```bash
$ gulp checkEncoding
[エンコーディング検出] test.jsx: ascii (信頼度: 100%)
❌ ⚠️ [エンコーディング] test.jsx: ascii (信頼度: 100%) - UTF-8以外のエンコーディングは許可されていません
[エンコーディング検出] index.php: UTF-8 (信頼度: 99%)
...
❌ 1個のファイルがUTF-8以外のエンコーディングです
```

**自動変換を有効化した場合**:
```bash
# gulpfile.mjsで autoConvert: true に設定後
$ gulp checkEncoding
[エンコーディング検出] index.php: SHIFT_JIS (信頼度: 99%)
⚠️ [エンコーディング] index.php: SHIFT_JIS (信頼度: 99%) - UTF-8以外のエンコーディングは許可されていません → UTF-8に自動変換しました
✅ 1個のファイルをUTF-8に変換しました
```

### 対象ファイル

- JavaScript: `.js`, `.jsx`, `.ts`, `.tsx`
- PHP: `.php`
- HTML: `.html`
- CSS: `.css`, `.scss`

### 除外されるファイル

- 画像ファイル（JPG、PNG、GIF、WebP、BMP、TIFF、SVG、ICO）
- `node_modules/`
- `wp-content/themes/**/assets/`
- `.min.js`, `.min.css`

### エンコーディングエラーの解決方法

**問題**: `❌ [エンコーディング] ファイル名: ascii` または `❌ [エンコーディング] ファイル名: Shift_JIS`

**解決方法**:
1. **エディタで該当ファイルをUTF-8で保存**（推奨）
   - エディタのエンコーディング設定を確認し、UTF-8で保存し直してください
   - 多くのエディタでは、ファイルを開いた状態で「名前を付けて保存」→「エンコーディング: UTF-8」を選択
2. **自動変換を有効化**（`gulpfile.mjs`で`autoConvert: true`に設定）
   - 設定変更後、`gulp checkEncoding`を実行すると自動的にUTF-8に変換されます
3. **チェックを無効化**（一時的な回避策）
   - `enableCheck: false`に設定することでチェックを無効化できます

**注意**: ASCIIとして検出された場合でも、UTF-8として正しくデコードできない場合はエラーとして扱われます。これは、エディタでISO-8859-1などとして表示されているファイルが正しく検出されるためです。

### 重要な注意事項

- **デフォルトはチェックのみ**: デフォルトではエンコーディングをチェックするのみで、自動変換は行いません。自動変換が必要な場合は`autoConvert: true`に設定してください
- **UTF-8以外はすべてエラー**: UTF-8以外のエンコーディング（ASCII、Shift_JIS、ISO-8859-1など）が検出された場合、すべてエラーとして表示されます
- **バックアップ推奨**: `autoConvert: true`の場合、エンコーディング変換はファイルを直接上書きします。重要なファイルは事前にバックアップを取ることを推奨します
- **別途実行が必要**: `gulp dev`や`gulp build`では自動的に実行されません。必要に応じて`gulp checkEncoding`を手動で実行してください

---

## ✅ チェック・リントコマンドの詳細

### 2種類のチェックツール

このプロジェクトには、**完全に別々の2つのチェックツール**があります：

1. **Markuplint（`lint:html` / `lint:file`）**: HTML/PHPの構文・アクセシビリティチェック
2. **カスタムチェック（`check:all` / `check:file`）**: プロジェクト独自のルールチェック

### 1. HTML/PHPリント（Markuplint）

Markuplintを使用してHTML/PHPファイルの構文やアクセシビリティをチェックします。

```bash
# 全ファイルのリント
npm run lint:html

# 特定ファイルのリント（ファイルパスを指定）
npm run lint:file index.php
npm run lint:file test/index.php
npm run lint:file "**/*.php"  # globパターンも使用可能
```

**チェック内容**:
- 必須属性の確認（`alt`、`width`、`height`、`loading`など）
- アクセシビリティチェック（WAI-ARIA、ランドマークロールなど）
- HTML構文の検証
- 必須要素の確認（`title`、`meta`タグなど）

### 2. カスタムチェック（check.js）

プロジェクト独自のルールをチェックします。**Markuplintとは別のチェック**です。

```bash
# 全ファイルのチェック
npm run check:all

# 特定ファイルのチェック（ファイルパスを指定する必要があります）
npm run check:file index.php
npm run check:file test/index.php
npm run check:file "**/*.php"  # globパターンも使用可能
```

**チェック内容**:
- プロジェクト構造の確認（必須フォルダ/ファイルの存在）
- 必須メタタグの確認（OGPタグ、description、titleなど）
- BEMクラス名の検証
- ダミーデータの検出（"xxx"、"サンプル"、"placeholder"など）
- 空のメタタグ・リンクの検出
- 死んだリンクの検出（HTTPステータスチェック）
- ファイル配置ルールの検証

**注意**: `npm run check:file`だけでは引数がないため、全ファイルチェック（`check:all`と同じ動作）になります。必ずファイルパスを指定してください。

### 使い方の例

```bash
# 例1: 特定のPHPファイルを両方のツールでチェック
npm run lint:file index.php    # Markuplintでチェック
npm run check:file index.php  # カスタムチェックでチェック

# 例2: 全ファイルをチェック
npm run lint:html   # Markuplintで全ファイルチェック
npm run check:all   # カスタムチェックで全ファイルチェック

# 例3: 複数ファイルを指定
npm run lint:file "test/*.php"
npm run check:file "test/*.php"

# 例4: 特定ディレクトリをチェック
npm run lint:file "test/**/*.php"
npm run check:file "test/**/*.php"
```

---

## 🖼️ 画像処理の詳細

### 処理フロー

1. **BMP/TIFF/GIF → PNG変換**: 圧縮可能な形式に変換
2. **画像最適化**: JPG、PNG、GIF圧縮
3. **WebP変換**: すべての画像をWebP形式に変換
4. **元画像削除**: WebP変換が成功した元画像を自動削除（設定により変更可能）

### 画像再圧縮コマンドの使い分け

画像再圧縮コマンドは、`compressed-images.json`の`recompress`フラグに応じて動作が異なります：

| コマンド | 対象 | 説明 |
|---------|------|------|
| `gulp imagesRecompress`<br>`npm run images:rc` | `recompress: true` のみ | 明示的に再圧縮フラグが設定された画像のみ |
| `gulp imagesRecompressAll`<br>`npm run images:rc-all` | `recompress: false` 以外すべて | 再圧縮フラグが`false`でないすべての画像 |
| `gulp imagesRecompressForce`<br>`npm run images:rc-force` | すべての画像 | フラグに関係なくすべての画像を強制再圧縮 |
| `gulp imageFile --file sample.jpg`<br>`npm run images:file sample.jpg` | 指定ファイルのみ | 特定のファイルのみを再圧縮 |

**使用例**:
- 特定の画像だけ再圧縮したい → `imagesRecompress`
- 新しく追加した画像を再圧縮したい → `imagesRecompressAll`
- すべての画像を強制的に再圧縮したい → `imagesRecompressForce`

### 圧縮レベルの設定

`compressed-images.json`で画像ごとに圧縮レベルを設定できます：

```json
{
    "wp-content/themes/theme-name/assets/img/sample.webp": {
        "mtimeMs": 1234567890123,
        "manual": false,
        "compressionLevel": "medium"
    }
}
```

**圧縮レベル**: `low` | `medium` | `high` | `maximum`

### 再圧縮フラグの設定方法

特定の画像のみを再圧縮したい場合、`compressed-images.json`で`recompress`フラグを設定します：

```json
{
    "wp-content/themes/theme-name/assets/img/sample.webp": {
        "mtimeMs": 1234567890123,
        "manual": false,
        "compressionLevel": "high",
        "recompress": true  // ← このフラグを追加
    }
}
```

**再圧縮フラグの値**:
- `recompress: true` → `gulp imagesRecompress`で再圧縮対象
- `recompress: false` → `gulp imagesRecompressAll`では対象外、`gulp imagesRecompressForce`では対象
- フラグなし → `gulp imagesRecompressAll`で対象

**実行コマンド**:
```bash
# recompress: true のみ再圧縮
gulp imagesRecompress
# または
npm run images:rc

# recompress: false 以外すべて再圧縮
gulp imagesRecompressAll
# または
npm run images:rc-all

# すべての画像を強制再圧縮（フラグに関係なく）
gulp imagesRecompressForce
# または
npm run images:rc-force
```

---

## 📁 ディレクトリ構成

```
プロジェクトルート/
├── gulpfile.mjs              # Gulp設定ファイル
├── package.json              # npm設定ファイル
├── compressed-images.json    # 画像圧縮履歴
├── src/
│   ├── scss/                 # SCSSソースファイル
│   │   ├── main.scss
│   │   ├── base/
│   │   ├── components/
│   │   └── pages/
│   └── js/                   # JavaScriptソースファイル
│       └── main.js
└── wp-content/
        └── themes/
                └── {テーマ名}/
                        └── assets/
                                ├── css/      # ビルドされたCSS
                                ├── js/       # ビルドされたJS
                                └── img/      # 画像ファイル
```

---

## 🔧 トラブルシューティング

### 画像処理でエラーが発生する

**問題**: 特定の画像処理でエラーが発生

**解決方法**:
```javascript
imageProcessing: {
    enableOptimize: true,
    enableWebpConversion: false,  // 問題のある処理を無効化
    enableBmpTiffConversion: true,
    enableCleanOriginal: false
}
```

### ファイル監視が動作しない

**問題**: ファイルを編集してもビルドが実行されない

**解決方法**:
1. 該当する機能が有効化されているか確認（`PROJECT_SETTINGS`を確認）
2. ファイルパスが正しいか確認
3. Gulpを再起動（`Ctrl+C`で停止後、`gulp dev`または`npm run dev`で再起動）

### SCSS/JSのビルドエラー

**問題**: SCSS/JSのコンパイル時にエラーが発生

**解決方法**:
1. エラーメッセージを確認
2. シンタックスエラーがないか確認
3. 必要なパッケージがインストールされているか確認：`npm install`

---

## 📝 ライセンス

ISC

---

## 💡 ヒント

- **設定変更後は必ず再起動**: `PROJECT_SETTINGS`を変更した場合は、`gulp dev`または`npm run dev`を再起動してください
- **バックアップを推奨**: `enableCleanOriginal: true`の場合、元画像が削除されるため、重要な画像はバックアップを取ることを推奨します
- **段階的に有効化**: 初めて使用する場合は、機能を段階的に有効化してテストすることを推奨します
- **コマンドの使い分け**: `gulp`コマンドと`npm run`コマンドは同じ機能を実行します。お好みの方を使用してください
