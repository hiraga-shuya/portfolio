/**
 * WordPressテーマ開発用Gulpfile
 *
 * 機能:
 * - Dart Sass、Autoprefixer、ソースマップを使用したSCSSからCSSへの変換
 * - コンポーネントとページ用のSCSSインデックスファイルの自動生成
 * - Webpack、Babel、ES Modulesを使用したモダンなJavaScriptバンドリング
 * - 画像最適化（JPG、PNG、GIF）
 * - 全画像タイプ（BMP、TIFF含む）の自動WebP変換
 * - WebP変換成功後の元画像ファイルの自動削除
 * - UTF-8エンコーディングチェックと自動変換
 * - ファイル監視と自動タスク実行
 * 
 * ============================================================
 * 【重要】プロジェクト設定のカスタマイズ方法
 * ============================================================
 * 
 * このファイルの下部（57行目～103行目付近）にある
 * 「PROJECT_SETTINGS」オブジェクトを編集することで、
 * プロジェクトに応じて不要な機能を無効化できます。
 * 
 * 詳細な設定方法は README.md を参照してください。
 * 
 * 例: 画像処理を無効化する場合
 *   enableImageProcessing: false
 * 
 * 例: WebP変換のみを無効化する場合
 *   imageProcessing: {
 *     enableWebpConversion: false
 *   }
 * 
 * ============================================================
 */

// コアモジュール
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Gulp & プラグイン
import gulp from 'gulp';
import plumber from 'gulp-plumber';
import notify from 'gulp-notify';
import { deleteAsync } from 'del';
import * as glob from 'glob';
import rename from 'gulp-rename';
import htmlBeautify from 'gulp-html-beautify';

// SCSS
import dartSass from 'gulp-dart-sass';
import autoprefixer from 'gulp-autoprefixer';
import sourcemaps from 'gulp-sourcemaps';

// JavaScript
import webpack from 'webpack';
import webpackStream from 'webpack-stream';

// 画像
import imagemin from 'gulp-imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminPngquant from 'imagemin-pngquant';
import imageminGifsicle from 'imagemin-gifsicle';
import imageminWebp from 'imagemin-webp';
import sharp from 'sharp';

// HTML/PHP処理
import replace from 'gulp-replace';
import through from 'through2';
import sizeOf from 'image-size';
import htmlmin from 'gulp-htmlmin';
import cheerio from 'gulp-cheerio';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

// ================================
// プロジェクト設定
// ================================
const THEME_NAME = 'portfolio';
const COMPRESSED_JSON = 'compressed-images.json';

// ================================
// 機能の有効/無効設定（プロジェクトに応じて変更してください）
// ================================
const PROJECT_SETTINGS = {
    // SCSS処理の有効化
    enableScss: true,
    
    // JavaScript処理の有効化
    enableJs: true,
    
    // HTML/PHPフォーマット処理の有効化
    enableHtmlFormat: true,
    
    // 画像処理の有効化
    enableImageProcessing: false,  // 一時的に無効化（EPERMエラー回避）
    
    // 画像処理の詳細設定
    imageProcessing: {
        enableOptimize: true,      // 画像の圧縮最適化
        enableWebpConversion: true, // WebP変換
        enableBmpTiffConversion: true, // BMP/TIFF/GIF→PNG変換
        enableCleanOriginal: true   // 元画像の自動削除
    },
    
    // HTML/PHPフォーマットの詳細設定
    htmlFormat: {
        enableImageAttributes: true,      // imgタグへの自動属性追加（width, height, alt, loading）
        enableEntityEscape: true,         // 特殊文字のHTMLエンティティ化
        enableIndentFormat: true,         // インデント整形
        enableTextNodeCleanup: true,      // テキストノード内の改行削除
        enableTrailingSpaceRemoval: true, // 行末スペース削除
        enableScriptLinkCleanup: true     // script/linkタグのクリーンアップ
    },
    
    // UTF-8エンコーディングチェック
    encoding: {
        enableCheck: true,           // エンコーディングチェックの有効化
        autoConvert: false,          // 非UTF-8ファイルを自動的にUTF-8に変換（チェックのみの場合はfalse）
        showWarnings: true,          // 警告メッセージの表示
        excludePatterns: [           // チェック除外パターン
            'node_modules/**',
            '**/vendor/**',
            '**/*.min.js',
            '**/*.min.css'
        ]
    }
};

// HTMLクリーンアップ設定
const HTML_CLEANUP_OPTIONS = {
    removeScriptType: true,        // scriptタグのtype="text/javascript"を削除
    removeScriptLanguage: true,    // scriptタグのlanguage="javascript"を削除
    removeLinkType: true,          // linkタグのtype="text/css"を削除
    removeEmptyAttributes: true,    // 空の属性値を削除
    removeDuplicateAttributes: true // 重複する属性を削除
};

// 日本語テキスト間のスペース処理設定
const JAPANESE_SPACE_REMOVAL = {
    /**
     * 日本語文字間のスペース削除レベル
     * 
     * 'none': スペースを削除しない（日本語間のスペースも保持）
     *   例: 「これは テスト です」→ 「これは テスト です」（そのまま）
     * 
     * 'japanese-only': 日本語文字間のスペースのみ削除（デフォルト）
     *   例: 「これは テスト です」→ 「これはテストです」
     *   例: 「Hello 世界 Test」→ 「Hello世界Test」（日英混在はスペース削除）
     * 
     * 'mixed-text': 日本語と英語が混在する場合のみスペースを保持
     *   例: 「これは テスト です」→ 「これはテストです」（日本語のみは削除）
     *   例: 「Hello 世界 Test」→ 「Hello 世界 Test」（日英混在は保持）
     */
    level: 'none'  // 'none' | 'japanese-only' | 'mixed-text'
};

// HTML/PHPフォーマットのインデント設定
const INDENT_SETTINGS = {
    /**
     * インデントサイズ（半角スペースの数）
     * HTML/PHPファイルの自動整形時に使用されるインデントのサイズを指定します
     */
    size: 4  // デフォルト: 4スペース
};

/**
 * ファイルのハッシュ値を計算（環境依存を避けるため）
 */
function calculateFileHash(filePath, cachedStat = null) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        
        // キャッシュされたstat情報がある場合は使用、ない場合は取得
        const stat = cachedStat || fs.statSync(filePath);
        
        // ファイルサイズが0の場合は即座にハッシュを返す（空ファイル）
        if (stat.size === 0) {
            return crypto.createHash('sha256').update('').digest('hex');
        }
        
        const fileBuffer = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (e) {
        console.error(`[ハッシュ計算エラー] ${filePath}:`, e.message);
        return null;
    }
}

/**
 * ファイルが変更されているかチェック（ハイブリッド方式：パフォーマンス最適化版）
 * 1. まずmtimeMsで判定（高速）- 変更がない場合はハッシュ計算をスキップ
 * 2. mtimeMsが異なる場合のみfileHashを計算して比較
 * 
 * メリット:
 * - 変更されていないファイル（大多数）はハッシュ計算をスキップできる
 * - 画像ファイルが多い場合、大幅なパフォーマンス向上が期待できる
 * - 環境依存の問題も解決（fileHashは必須として保存）
 */
function isFileChanged(filePath, storedData) {
    try {
        if (!fs.existsSync(filePath)) {
            return true; // ファイルが存在しない場合は変更されたとみなす
        }
        
        const stat = fs.statSync(filePath);
        const currentMtimeMs = stat.mtimeMs || stat.mtime * 1000;
        
        // fileHashが存在しない場合は、常に変更されたとみなす（初回処理）
        if (!storedData.fileHash) {
            return true;
        }
        
        // mtimeMsが存在する場合、まずmtimeMsで判定（高速）
        if (storedData.mtimeMs !== undefined) {
            // mtimeMsが同じ場合は変更なし（ハッシュ計算をスキップ）
            if (currentMtimeMs === storedData.mtimeMs) {
                return false;
            }
            // mtimeMsが異なる場合は、fileHashで確認（内容が本当に変更されたか）
            // ただし、環境依存を避けるため、mtimeMsは参考程度に使用
            // 最終的にはfileHashで判定
        }
        
        // fileHashで最終判定
        const currentHash = calculateFileHash(filePath, stat);
        if (!currentHash) {
            return true; // ハッシュ計算失敗時は変更されたとみなす
        }
        
        return currentHash !== storedData.fileHash;
    } catch (e) {
        // エラー時は変更されたとみなす（安全側に倒す）
        return true;
    }
}

function loadCompressedJson() {
    try {
        if (fs.existsSync(COMPRESSED_JSON)) {
            const raw = fs.readFileSync(COMPRESSED_JSON, 'utf8');
            let data = JSON.parse(raw);
            // 手動編集で配列やnullになってもOKなように
            if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
            
            const projectRoot = process.cwd();
            
            // 旧形式（数値のみ）またはmtimeMs形式を新形式（fileHash + mtimeMs）に変換
            for (const k of Object.keys(data)) {
                if (typeof data[k] === 'number') {
                    // 旧形式（数値のみ = mtimeMs）: ファイルのハッシュを計算して変換
                    const filePath = path.join(projectRoot, k);
                    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
                    if (stat) {
                        const fileHash = calculateFileHash(filePath, stat);
                        const mtimeMs = stat.mtimeMs || stat.mtime * 1000;
                        if (fileHash) {
                            // 旧形式の数値（mtimeMs）を保持しつつ、fileHashを追加
                            data[k] = { 
                                fileHash, 
                                mtimeMs: data[k], // 旧形式の値を保持（環境依存だが、初回変換時のみ）
                                manual: false, 
                                compressionLevel: 'low', 
                                recompress: undefined 
                            };
                        } else {
                            // ファイルが存在しない場合は削除
                            delete data[k];
                        }
                    } else {
                        // ファイルが存在しない場合は削除
                        delete data[k];
                    }
                } else if (typeof data[k] !== 'object' || !data[k]) {
                    delete data[k];
                } else {
                    // mtimeMsがあるがfileHashがない場合は変換（旧形式からの移行）
                    if (data[k].mtimeMs && !data[k].fileHash) {
                        const filePath = path.join(projectRoot, k);
                        const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
                        if (stat) {
                            const fileHash = calculateFileHash(filePath, stat);
                            if (fileHash) {
                                // fileHashを追加（mtimeMsは保持してハイブリッド方式で使用）
                                data[k].fileHash = fileHash;
                                // mtimeMsは既に存在するのでそのまま保持（ハイブリッド方式のパフォーマンス最適化用）
                            } else {
                                // ファイルが存在しない場合は削除
                                delete data[k];
                            }
                        } else {
                            // ファイルが存在しない場合は削除
                            delete data[k];
                        }
                    }
                    
                    // 既存のオブジェクトにcompressionLevelがない場合はデフォルト値を設定
                    if (!data[k].compressionLevel) {
                        data[k].compressionLevel = 'low';
                    }
                    // recompressフィールドが未定義の場合はundefinedに設定（削除）
                    if (!data[k].hasOwnProperty('recompress')) {
                        data[k].recompress = undefined;
                    }
                }
            }
            return data;
        }
    } catch (e) {
        console.error('[画像圧縮] json読み込み失敗:', e);
    }
    return {};
}

function saveCompressedJson(data) {
    try {
        // パス昇順で保存
        const sorted = {};
        Object.keys(data).sort().forEach(k => {
            const entry = { ...data[k] };
            // recompressがundefinedまたはnullの場合は削除
            if (entry.recompress === undefined || entry.recompress === null) {
                delete entry.recompress;
            }
            sorted[k] = entry;
        });
        fs.writeFileSync(COMPRESSED_JSON, JSON.stringify(sorted, null, 4), 'utf8');
        console.log(`[画像圧縮] json保存完了: ${Object.keys(sorted).length}件`);
    } catch (e) {
        console.error('[画像圧縮] json保存失敗:', e);
    }
}

const failedFiles = new Set();

// JSONファイルの最終更新時刻を記録
let lastJsonMtime = 0;

// 強制再圧縮フラグ
let forceRecompress = false;

// 処理中のファイルを追跡（無限ループ防止）
const processingFiles = new Set();

// 圧縮レベル設定（PNG圧縮の問題を修正）
const COMPRESSION_LEVELS = {
    low: {
        jpeg: { quality: 90, progressive: true },
        png: { quality: [0.85, 0.95], speed: 1, strip: true, force: true },
        gif: { interlaced: true, optimizationLevel: 1 },
        webp: { quality: 90 }
    },
    medium: {
        jpeg: { quality: 80, progressive: true },
        png: { quality: [0.7, 0.85], speed: 1, strip: true, force: true },
        gif: { interlaced: true, optimizationLevel: 3 },
        webp: { quality: 80 }
    },
    high: {
        jpeg: { quality: 70, progressive: true },
        png: { quality: [0.6, 0.75], speed: 1, strip: true, force: true },
        gif: { interlaced: true, optimizationLevel: 5 },
        webp: { quality: 70 }
    },
    maximum: {
        jpeg: { quality: 60, progressive: true },
        png: { quality: [0.5, 0.7], speed: 1, strip: true, force: true },
        gif: { interlaced: true, optimizationLevel: 7 },
        webp: { quality: 60 }
    }
};

function getCompressionSettings(level = 'low') {
    return COMPRESSION_LEVELS[level] || COMPRESSION_LEVELS.low;
}


// 画像メタデータの取得とログ出力
async function getImageMetadata(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return { error: 'ファイルが存在しません' };
        }
        
        let metadata;
        try {
            metadata = await sharp(filePath).metadata();
        } catch (sharpError) {
            // BMPファイルの場合、特別な処理を行う
            if (filePath.toLowerCase().endsWith('.bmp')) {
                // SharpがサポートしていないBMP形式の場合はエラーを返す
                if (sharpError.message.includes('unsupported image format')) {
                    return { error: `サポートされていないBMP形式: ${sharpError.message}` };
                }
                
                // その他のBMPエラーの場合
                try {
                    const testSharp = sharp(filePath);
                    metadata = await testSharp.metadata();
                    
                    // formatが正しく認識されない場合は手動で設定
                    if (!metadata.format || metadata.format === 'unknown') {
                        metadata.format = 'bmp';
                    }
                } catch (bmpError) {
                    return { error: `BMP読み込みエラー: ${bmpError.message}` };
                }
            } else {
                throw sharpError;
            }
        }
        
        const fileSize = fs.statSync(filePath).size;
        
        return {
            width: metadata.width,
            height: metadata.height,
            channels: metadata.channels,
            format: metadata.format,
            fileSize,
            hasAlpha: metadata.hasAlpha,
            density: metadata.density,
            space: metadata.space
        };
    } catch (error) {
        return { error: error.message };
    }
}

// 画像処理前後の検証
async function logImageComparison(beforePath, afterPath, processName) {
    const beforeMeta = await getImageMetadata(beforePath);
    const afterMeta = await getImageMetadata(afterPath);
    
    if (beforeMeta.error || afterMeta.error) {
        return false;
    }
    
    // 基本的な検証
    const issues = [];
    if (afterMeta.width !== beforeMeta.width) issues.push(`幅が変更: ${beforeMeta.width} → ${afterMeta.width}`);
    if (afterMeta.height !== beforeMeta.height) issues.push(`高さが変更: ${beforeMeta.height} → ${afterMeta.height}`);
    if (afterMeta.fileSize === 0) issues.push('ファイルサイズが0');
    if (afterMeta.fileSize < beforeMeta.fileSize * 0.01) issues.push(`ファイルサイズが異常に小さい: ${afterMeta.fileSize} bytes`);
    
    if (issues.length > 0) {
        return false;
    } else {
        return true;
    }
}

// パス設定（THEME_NAME変数を使用）
const paths = {
    scss: {
        src: 'src/scss/main.scss',
        dest: `./wp-content/themes/${THEME_NAME}/assets/css/`,
        watch: 'src/scss/**/*.scss',
        baseDir: 'src/scss'
    },
    js: {
        src: 'src/js/main.js',
        dest: `./wp-content/themes/${THEME_NAME}/assets/js/`,
        watch: 'src/js/**/*.{js,jsx}'
    },
    images: {
        src: `wp-content/themes/${THEME_NAME}/assets/img/**/*.{jpg,jpeg,png,gif,bmp,tiff,JPG,JPEG,PNG,GIF,BMP,TIFF}`,
        dest: `./wp-content/themes/${THEME_NAME}/assets/img/`,
        watch: `wp-content/themes/${THEME_NAME}/assets/img/**/*.{jpg,jpeg,png,gif,bmp,tiff,JPG,JPEG,PNG,GIF,BMP,TIFF}`
    },
    html: {
        src: '**/*.{html,php}',
        dest: './',
        watch: '**/*.{html,php}',
        images: '**/*.{jpg,jpeg,png,gif,webp,JPG,JPEG,PNG,GIF,WEBP}',
        exclude: ['node_modules/**', `wp-content/themes/${THEME_NAME}/assets/**`, 'compressed-images.json']
    },
    clean: {
        css: `./wp-content/themes/${THEME_NAME}/assets/css/**/*`,
        js: `./wp-content/themes/${THEME_NAME}/assets/js/**/*`,
    }
};

// --- CLEAN タスク ---
/**
 * 生成されたCSSとJSファイルを削除
 */
export const clean = () => {
    return deleteAsync([paths.clean.css, paths.clean.js]);
};

/**
 * 指定ディレクトリ内のSCSSファイルを再帰的に収集（2階層目ディレクトリ用）
 * @param {string} dirPath - 検索対象のディレクトリパス（2階層目ディレクトリ）
 * @param {string} baseDir - 基準ディレクトリ（2階層目ディレクトリのパス）
 * @returns {Array<string>} - @forward用のパス配列（例: ["reset", "subdir/button"]）
 */
function collectScssFiles(dirPath, baseDir) {
    const files = [];
    
    if (!fs.existsSync(dirPath)) {
        return files;
    }
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
            // サブディレクトリ内のファイルを再帰的に収集
            const subFiles = collectScssFiles(fullPath, baseDir);
            files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.scss') && entry.name !== '_index.scss') {
            // ファイル名から拡張子とアンダースコアを除去
            const nameWithoutExt = entry.name.replace(/^_/, '').replace(/\.scss$/, '');
            
            // 2階層目ディレクトリからの相対パスを計算
            const relativePath = path.relative(baseDir, dirPath);
            
            if (relativePath === '' || relativePath === '.') {
                // 2階層目ディレクトリ直下のファイル（ファイル名のみ）
                files.push(nameWithoutExt);
            } else {
                // サブディレクトリ内のファイル（相対パス形式: "subdir/filename"）
                // Windowsパスをスラッシュに統一
                const normalizedPath = relativePath.replace(/\\/g, '/');
                files.push(`${normalizedPath}/${nameWithoutExt}`);
            }
        }
    }
    
    return files;
}

/**
 * SCSSインデックスファイルを生成
 * @param {string} dirPath - 対象ディレクトリパス（2階層目ディレクトリ）
 * @param {string} indexFile - 生成するインデックスファイルのパス
 * @returns {boolean} - 更新があったかどうか
 */
function generateIndexFile(dirPath, indexFile) {
    if (!fs.existsSync(dirPath)) {
        return false;
    }
    
    const baseDir = dirPath;
    const allFiles = collectScssFiles(dirPath, baseDir);
    
    // 既存のインデックスファイルから順序とコメントを完全に保持（順序入れ替えなし）
    let finalFiles = allFiles;
    let headerLines = []; // @charset行までの行（//文字コードはutf-8、@charset "UTF-8";）
    let nonForwardLines = []; // @forward行以外のすべての行（コメント、空行など）
    let forwardOrder = []; // @forward行の順序
    
    if (fs.existsSync(indexFile)) {
        const current = fs.readFileSync(indexFile, 'utf8');
        const lines = current.split(/\r?\n/);
        const seen = new Set();
        let foundCharset = false;
        
        // ファイル全体を解析して、@forward行とそれ以外の行を分離
        lines.forEach((line, index) => {
            // @charset行までをヘッダーとして保持
            if (!foundCharset) {
                headerLines.push(line);
                if (line.includes('@charset')) {
                    foundCharset = true;
                }
                return;
            }
            
            // @forward行を検出
            const forwardMatch = line.match(/^@forward\s+"([^"]+)";/);
            if (forwardMatch) {
                const forwardPath = forwardMatch[1];
                // 既存のファイルリストに含まれているかチェック（存在するファイルのみ保持）
                if (allFiles.includes(forwardPath) && !seen.has(forwardPath)) {
                    forwardOrder.push(forwardPath);
                    seen.add(forwardPath);
                }
            } else {
                // @forward行ではない行はすべて保持（コメント、空行など）
                nonForwardLines.push(line);
            }
        });
        
        // 新規ファイルを末尾に追加（順序は変更しない）
        const remaining = allFiles.filter(file => !seen.has(file));
        finalFiles = [...forwardOrder, ...remaining];
    } else {
        // ファイルが存在しない場合はデフォルトのヘッダーを作成
        headerLines = ['//文字コードはutf-8', '@charset "UTF-8";'];
    }
    
    // ファイルを再構築
    // ヘッダー + 非@forward行（コメントなど） + @forward行
    const headerSection = headerLines.join('\n');
    
    // 非@forward行を結合（元の構造を正確に保持）
    let nonForwardSection = '';
    let trimmedNonForwardLines = [];
    let firstLineIsEmpty = false;
    
    if (nonForwardLines.length > 0) {
        // 末尾の連続する空行を削除（最後の1つの空行は保持）
        trimmedNonForwardLines = [...nonForwardLines];
        // 末尾から連続する空行を削除（最後の1つは残す）
        while (trimmedNonForwardLines.length > 0 && 
               trimmedNonForwardLines[trimmedNonForwardLines.length - 1].trim() === '' &&
               trimmedNonForwardLines.length > 1 &&
               trimmedNonForwardLines[trimmedNonForwardLines.length - 2].trim() === '') {
            trimmedNonForwardLines.pop();
        }
        
        // @charset行の後の空行を保持するため、最初の行が空行でない場合は先頭に空行を追加
        firstLineIsEmpty = trimmedNonForwardLines.length > 0 && trimmedNonForwardLines[0].trim() === '';
        if (!firstLineIsEmpty) {
            // @charset行の後に空行を追加するため、先頭に空行を追加
            trimmedNonForwardLines.unshift('');
        }
        
        // 元の行をそのまま結合（改行はjoinで自動的に追加される）
        nonForwardSection = trimmedNonForwardLines.join('\n');
        // コメントブロックの後の空行を保持するため、最後の行が空行でない場合は空行を追加
        const lastLineIsEmpty = trimmedNonForwardLines.length > 0 && trimmedNonForwardLines[trimmedNonForwardLines.length - 1].trim() === '';
        if (!lastLineIsEmpty) {
            // コメントブロックの後に空行を追加（@forward行との間に空行を確保）
            nonForwardSection += '\n';
        }
    } else {
        // 非@forward行がない場合、ヘッダーと@forward行の間に空行を1つ追加
        nonForwardSection = '\n';
    }
    
    const forwardSection = finalFiles.map(file => `@forward "${file}";`).join('\n');
    
    // ヘッダーとnonForwardSectionの間の改行を追加
    // @charset行の後には常に空行を1つ保持する
    const separator = '\n';
    
    // ファイル末尾の改行は1つだけ残す
    // forwardSectionがある場合は、その後に改行を1つ追加
    // forwardSectionがない場合は、nonForwardSectionの末尾の改行をそのまま使用（追加の改行を入れない）
    let content;
    if (forwardSection) {
        content = `${headerSection}${separator}${nonForwardSection}${forwardSection}\n`;
    } else {
        // @forward行がない場合、nonForwardSectionの末尾の改行をそのまま使用
        // nonForwardSectionは既に末尾に\nを持っているので、追加の改行は不要
        content = `${headerSection}${separator}${nonForwardSection}`;
    }
    const existing = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf8') : '';
    
    if (existing !== content) {
        console.log(`[SCSS Index] 更新中 -> ${path.relative(process.cwd(), indexFile)}`);
        fs.writeFileSync(indexFile, content, 'utf8');
        return true;
    }
    
    return false;
}

/**
 * main.scssを自動更新
 * @param {Array<string>} dirNames - 2階層目ディレクトリ名の配列
 */
function updateMainScss(dirNames) {
    const mainScssPath = paths.scss.src;
    
    // 既存のmain.scssから順序を完全に保持（順序入れ替えなし）
    let finalDirNames = dirNames;
    if (fs.existsSync(mainScssPath)) {
        const current = fs.readFileSync(mainScssPath, 'utf8');
        const ordered = [];
        const seen = new Set();
        
        // 既存の@use行から順序を取得（既存の順序を完全に保持）
        current.split(/\r?\n/).forEach(line => {
            const m = line.match(/^@use\s+"([^"]+)";/);
            if (m) {
                const useName = m[1];
                // 既存のディレクトリリストに含まれているかチェック（存在するディレクトリのみ保持）
                if (dirNames.includes(useName) && !seen.has(useName)) {
                    ordered.push(useName);
                    seen.add(useName);
                }
            }
        });
        
        // 新規ディレクトリを末尾に追加（順序は変更しない）
        const remaining = dirNames.filter(name => !seen.has(name));
        finalDirNames = [...ordered, ...remaining];
    }
    
    const content = `//文字コードはutf-8\n@charset "UTF-8";\n\n${finalDirNames.map(name => `@use "${name}";`).join('\n')}\n`;
    const existing = fs.existsSync(mainScssPath) ? fs.readFileSync(mainScssPath, 'utf8') : '';
    
    if (existing !== content) {
        console.log(`[SCSS Index] 更新中 -> ${path.relative(process.cwd(), mainScssPath)}`);
        fs.writeFileSync(mainScssPath, content, 'utf8');
    }
}

const scssIndexGenerator = (done) => {
    try {
        const scssBaseDir = paths.scss.baseDir;
        
        if (!fs.existsSync(scssBaseDir)) {
            console.log(`[SCSS Index] ディレクトリが存在しません: ${scssBaseDir}`);
            done();
            return;
        }
        
        // 2階層目ディレクトリを検出
        const entries = fs.readdirSync(scssBaseDir, { withFileTypes: true });
        const secondLevelDirs = entries
            .filter(entry => entry.isDirectory() && entry.name !== 'node_modules')
            .map(entry => ({
                name: entry.name,
                path: path.join(scssBaseDir, entry.name),
                indexFile: path.join(scssBaseDir, entry.name, '_index.scss')
            }));
        
        // 各2階層目ディレクトリのインデックスファイルを生成
        const dirNames = [];
        for (const dir of secondLevelDirs) {
            const updated = generateIndexFile(dir.path, dir.indexFile);
            if (updated || fs.existsSync(dir.indexFile)) {
                dirNames.push(dir.name);
            }
        }
        
        // main.scssを更新
        if (dirNames.length > 0) {
            updateMainScss(dirNames);
        }
        
        done();
    } catch (err) {
        done(err);
    }
};

/**
 * SCSSファイルをCSSにコンパイル
 */
const compileScss = () => {
    // SCSS処理が無効な場合はスキップ
    if (!PROJECT_SETTINGS.enableScss) {
        return Promise.resolve();
    }
    
    return gulp.src(paths.scss.src)
        .pipe(plumber({ errorHandler: notify.onError('Error: <%= error.message %>') }))
        .pipe(sourcemaps.init())
        .pipe(dartSass({ outputStyle: 'compressed' }).on('error', dartSass.logError))
        .pipe(autoprefixer({ cascade: true }))
        .pipe(rename('main.min.css'))
        .pipe(sourcemaps.write('./', {
            sourceRoot: '../scss/',
            addComment: true,
            includeContent: false,
            // タイムスタンプを固定値に設定（環境依存を避けるため）
            mapSources: (sourcePath) => sourcePath
        }))
        .pipe(gulp.dest(paths.scss.dest));
};

export const scss = gulp.series(scssIndexGenerator, compileScss);

/**
 * エンコーディングチェック専用タスク（全ファイル対象）
 * Gulpのストリームを使わず、fsで直接読み込む
 */
export const checkEncoding = async () => {
    if (!PROJECT_SETTINGS.encoding.enableCheck) {
        console.log('[エンコーディングチェック] スキップ（設定で無効化されています）');
        return;
    }
    
    const files = await glob.glob('**/*.{js,jsx,ts,tsx,php,html,css,scss}', {
        ignore: ['node_modules/**', 'wp-content/themes/**/assets/**']
    });
    
    let convertedCount = 0;
    let errorCount = 0;
    const projectRoot = process.cwd();
    
    for (const file of files) {
        const filePath = path.join(projectRoot, file);
        const relativePath = path.relative(projectRoot, filePath);
        
        // 画像ファイルはスキップ
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.ico'];
        const ext = path.extname(filePath).toLowerCase();
        if (imageExtensions.includes(ext)) {
            continue;
        }
        
        // 除外パターンに一致する場合はスキップ
        const shouldExclude = PROJECT_SETTINGS.encoding.excludePatterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
            return regex.test(relativePath);
        });
        
        if (shouldExclude) {
            continue;
        }
        
        try {
            // バイナリとしてファイルを読み込む
            const buffer = fs.readFileSync(filePath);
            
            // エンコーディング検出
            const detected = jschardet.detect(buffer);
            
            // デバッグ用ログ
            if (PROJECT_SETTINGS.encoding.showWarnings && detected && detected.encoding) {
                console.log(`[エンコーディング検出] ${relativePath}: ${detected.encoding} (信頼度: ${((detected.confidence || 0) * 100).toFixed(0)}%)`);
            }
            
            if (!detected || !detected.encoding) {
                continue;
            }
            
            const encoding = detected.encoding.toLowerCase();
            const confidence = detected.confidence || 0;
            
            // UTF-8として正しくデコードできるか検証
            let isValidUtf8 = false;
            try {
                const utf8Decoded = buffer.toString('utf8');
                // UTF-8としてデコードした結果を再度エンコードして、元のバッファと比較
                const reencoded = Buffer.from(utf8Decoded, 'utf8');
                // 置換文字（）が含まれていないかチェック
                if (!utf8Decoded.includes('\ufffd') && buffer.equals(reencoded)) {
                    isValidUtf8 = true;
                }
            } catch (e) {
                // UTF-8としてデコードできない
                isValidUtf8 = false;
            }
            
            // UTF-8として検出され、かつUTF-8として正しくデコードできる場合のみスキップ
            if (encoding === 'utf-8' && isValidUtf8) {
                continue;
            }
            
            // ASCIIとして検出された場合でも、UTF-8として正しくデコードできない場合はエラー
            // UTF-8以外のエンコーディングはすべてエラーとして扱う
            if (encoding !== 'utf-8') {
                // UTF-8でない場合の処理
                const warningMessage = `⚠️ [エンコーディング] ${relativePath}: ${detected.encoding} (信頼度: ${(confidence * 100).toFixed(0)}%) - UTF-8以外のエンコーディングは許可されていません`;
                
                if (PROJECT_SETTINGS.encoding.autoConvert) {
                    try {
                        // 検出されたエンコーディングからUTF-8に変換
                        const decoded = iconv.decode(buffer, detected.encoding);
                        const utf8Buffer = iconv.encode(decoded, 'utf-8');
                        
                        // ファイルを上書き
                        fs.writeFileSync(filePath, utf8Buffer);
                        convertedCount++;
                        
                        if (PROJECT_SETTINGS.encoding.showWarnings) {
                            console.log(`${warningMessage} → UTF-8に自動変換しました`);
                        }
                    } catch (convertError) {
                        console.error(`❌ [エンコーディング変換失敗] ${relativePath}: ${convertError.message}`);
                    }
                } else {
                    if (PROJECT_SETTINGS.encoding.showWarnings) {
                        console.error(`❌ ${warningMessage}`);
                    }
                    errorCount++;
                }
                continue;
            }
            
            // 信頼度が低い場合はスキップ（ただし、UTF-8として正しくデコードできない場合はエラー）
            if (confidence < 0.5 && isValidUtf8) {
                continue;
            }
            
            // UTF-8として検出されたが、正しくデコードできない場合
            const warningMessage = `⚠️ [エンコーディング] ${relativePath}: ${detected.encoding} (信頼度: ${(confidence * 100).toFixed(0)}%) - UTF-8として正しくデコードできません`;
            
            if (PROJECT_SETTINGS.encoding.autoConvert) {
                try {
                    // 検出されたエンコーディングからUTF-8に変換
                    const decoded = iconv.decode(buffer, detected.encoding);
                    const utf8Buffer = iconv.encode(decoded, 'utf-8');
                    
                    // ファイルを上書き
                    fs.writeFileSync(filePath, utf8Buffer);
                    convertedCount++;
                    
                    if (PROJECT_SETTINGS.encoding.showWarnings) {
                        console.log(`${warningMessage} → UTF-8に自動変換しました`);
                    }
                } catch (convertError) {
                    console.error(`❌ [エンコーディング変換失敗] ${relativePath}: ${convertError.message}`);
                }
            } else {
                if (PROJECT_SETTINGS.encoding.showWarnings) {
                    console.error(`❌ ${warningMessage}`);
                }
                errorCount++;
            }
        } catch (error) {
            console.warn(`⚠️ [エンコーディングチェック] ${relativePath}: ${error.message}`);
        }
    }
    
    if (convertedCount > 0) {
        console.log(`\n✅ ${convertedCount}個のファイルをUTF-8に変換しました`);
    } else if (errorCount > 0) {
        console.log(`\n❌ ${errorCount}個のファイルがUTF-8以外のエンコーディングです`);
    } else {
        console.log('\n✅ すべてのファイルがUTF-8です');
    }
};

export const js = () => {
    // JavaScript処理が無効な場合はスキップ
    if (!PROJECT_SETTINGS.enableJs) {
        return Promise.resolve();
    }
    
    return gulp.src(paths.js.src)
        .pipe(plumber({ errorHandler: notify.onError('Error: <%= error.message %>') }))
        // 注意: エンコーディングチェックは 'gulp checkEncoding' タスクで別途実行してください
        .pipe(webpackStream({
            mode: 'production',
            output: { 
                filename: 'main.min.js',
                // ソースマップのファイル名にタイムスタンプを含めない（環境依存を避けるため）
                sourceMapFilename: '[file].map'
            },
            module: {
                rules: [{
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: { presets: ['@babel/preset-env'] }
                    }
                }]
            },
            devtool: 'source-map',
            target: ['web', 'es5']
        }, webpack))
        .pipe(gulp.dest(paths.js.dest));
};

// --- UTF-8エンコーディングチェック ---

/**
 * ファイルのエンコーディングをチェックし、UTF-8でない場合は警告または自動変換
 */
const checkAndConvertEncoding = () => {
    // エンコーディングチェックが無効な場合はスキップ
    if (!PROJECT_SETTINGS.encoding.enableCheck) {
        return through.obj(function(file, enc, callback) {
            callback(null, file);
        });
    }
    
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }

        try {
            // 画像ファイルはスキップ
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.ico'];
            const ext = path.extname(file.path).toLowerCase();
            if (imageExtensions.includes(ext)) {
                return callback(null, file);
            }
            
            // 除外パターンに一致する場合はスキップ
            const relativePath = path.relative(process.cwd(), file.path);
            const shouldExclude = PROJECT_SETTINGS.encoding.excludePatterns.some(pattern => {
                // minimatchを使ったパターンマッチング（簡易版）
                const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
                return regex.test(relativePath);
            });
            
            if (shouldExclude) {
                return callback(null, file);
            }
            
            // バッファからエンコーディングを検出
            const buffer = file.contents;
            
            // デバッグ: 最初の16バイトを確認
            if (relativePath === 'test.jsx' && PROJECT_SETTINGS.encoding.showWarnings) {
                console.log(`[デバッグ] ${relativePath} 最初の16バイト:`, buffer.slice(0, 16).toString('hex'));
                console.log(`[デバッグ] バッファサイズ:`, buffer.length);
            }
            
            // BOM（Byte Order Mark）をチェック
            let bomEncoding = null;
            if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
                bomEncoding = 'utf-8';  // UTF-8 BOM
            } else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
                bomEncoding = 'utf-16be';  // UTF-16 BE BOM
            } else if (buffer.length >= 2 && buffer[1] === 0xFE && buffer[0] === 0xFF) {
                bomEncoding = 'utf-16le';  // UTF-16 LE BOM
            }
            
            // BOMがあればそれを使用、なければjschardetで検出
            let encoding, confidence;
            if (bomEncoding) {
                encoding = bomEncoding;
                confidence = 1.0;
            } else {
                const detected = jschardet.detect(buffer);
                
                // デバッグ用ログ（開発時のみ）
                if (PROJECT_SETTINGS.encoding.showWarnings && detected && detected.encoding) {
                    console.log(`[エンコーディング検出] ${relativePath}: ${detected.encoding} (信頼度: ${((detected.confidence || 0) * 100).toFixed(0)}%)`);
                }
                
                // UTF-8またはASCII（UTF-8と互換）の場合はOK
                if (!detected || !detected.encoding) {
                    // 検出できない場合は、ファイルの内容をチェック
                    // ヌルバイトがあればバイナリファイルとして扱う
                    if (buffer.indexOf(0) !== -1) {
                        return callback(null, file);  // バイナリファイルはスキップ
                    }
                    // それ以外はUTF-8として扱う
                    return callback(null, file);
                }
                
                encoding = detected.encoding.toLowerCase();
                confidence = detected.confidence || 0;
            }
            
            // UTF-8、ASCII の場合はスキップ
            if (encoding === 'utf-8' || encoding === 'ascii') {
                return callback(null, file);
            }
            
            // 信頼度が低い場合でも、明らかに非UTF-8の場合は変換を試みる
            if (confidence < 0.5 && buffer.length < 100) {
                // ファイルが小さすぎて検出できない場合はスキップ
                return callback(null, file);
            }
            
            // UTF-8でない場合の処理
            const warningMessage = `⚠️ [エンコーディング] ${relativePath}: ${detected.encoding} (信頼度: ${(confidence * 100).toFixed(0)}%)`;
            
            if (PROJECT_SETTINGS.encoding.autoConvert) {
                try {
                    // 検出されたエンコーディングからUTF-8に変換
                    const decoded = iconv.decode(buffer, detected.encoding);
                    const utf8Buffer = iconv.encode(decoded, 'utf-8');
                    file.contents = utf8Buffer;
                    
                    if (PROJECT_SETTINGS.encoding.showWarnings) {
                        console.log(`${warningMessage} → UTF-8に自動変換しました`);
                    }
                    
                    return callback(null, file);
                } catch (convertError) {
                    // 変換に失敗した場合はエラー
                    console.error(`❌ [エンコーディング変換失敗] ${relativePath}: ${convertError.message}`);
                    return callback(new Error(`UTF-8への変換に失敗しました: ${relativePath}`));
                }
            } else {
                // 自動変換が無効な場合はエラーとして扱う
                if (PROJECT_SETTINGS.encoding.showWarnings) {
                    console.error(`❌ ${warningMessage}`);
                }
                return callback(new Error(`UTF-8でないファイルが検出されました: ${relativePath} (${detected.encoding})`));
            }
            
        } catch (error) {
            // エンコーディングチェックでエラーが発生した場合は警告を出してスキップ
            console.warn(`⚠️ [エンコーディングチェック] ${file.path}: ${error.message}`);
            callback(null, file);
        }
    });
};

// --- HTML/PHP処理タスク ---

/**
 * 画像サイズを取得してimgタグにwidth、height、alt、loading属性を追加
 */
const addImageAttributes = () => {
    // 機能が無効な場合はスキップ
    if (!PROJECT_SETTINGS.htmlFormat.enableImageAttributes) {
        return through.obj(function(file, enc, callback) {
            callback(null, file);
        });
    }
    return through.obj(async function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }

        try {
            let content = file.contents.toString('utf8');
            
            // imgタグの正規表現（より柔軟なマッチング）
            const imgRegex = /<img([^>]*?)>/gi;
            
            // 非同期処理のため、すべてのimgタグを一度に処理
            const imgMatches = [...content.matchAll(imgRegex)];
            const processedMatches = [];
            
            for (const match of imgMatches) {
                const fullMatch = match[0];
                const attrs = match[1];
                
                // src属性を抽出
                const srcMatch = fullMatch.match(/src\s*=\s*["']([^"']+)["']/i);
                if (!srcMatch) {
                    processedMatches.push(fullMatch);
                    continue;
                }
                
                const srcPath = srcMatch[1];
                let imagePath;
                
                // 相対パスを絶対パスに変換
                if (srcPath.startsWith('./') || srcPath.startsWith('../')) {
                    // 相対パスの場合、現在のファイルからの相対パスとして扱う
                    const fileDir = path.dirname(file.path);
                    imagePath = path.resolve(fileDir, srcPath);
                } else if (srcPath.startsWith('/')) {
                    // 絶対パスの場合（/で始まる場合）、プロジェクトルートからの相対パスとして扱う
                    imagePath = path.resolve(process.cwd(), srcPath.substring(1));
                } else {
                    // その他の場合（相対パス）
                    const fileDir = path.dirname(file.path);
                    imagePath = path.resolve(fileDir, srcPath);
                }
                
                let newAttrs = attrs;
                let hasChanges = false;
                let dimensions = null;
                
                // 画像サイズを取得（WebPファイルも含む）
                try {
                    if (fs.existsSync(imagePath)) {
                        // WebPファイルの場合はSharpを使用、それ以外はsizeOfを使用
                        if (imagePath.toLowerCase().endsWith('.webp')) {
                            try {
                                const metadata = await sharp(imagePath).metadata();
                                if (metadata && metadata.width && metadata.height) {
                                    dimensions = { width: metadata.width, height: metadata.height };
                                }
                            } catch (sharpError) {
                                // Sharpでエラーが発生した場合はsizeOfを試行
                                try {
                                    dimensions = sizeOf(imagePath);
                                } catch (sizeOfError) {
                                    throw new Error(`Sharp: ${sharpError.message}, sizeOf: ${sizeOfError.message}`);
                                }
                            }
                        } else {
                            dimensions = sizeOf(imagePath);
                        }
                    }
                } catch (error) {
                    // エラーが発生した場合は警告を1回だけ表示し、処理を続行
                    if (!failedFiles.has(imagePath)) {
                        failedFiles.add(imagePath);
                        console.warn(`[画像サイズ取得エラー] ${imagePath}: ${error.message}`);
                    }
                }
                
                // 属性を固定順序で追加（alt → loading → width → height）
                const attributesToAdd = [];
                
                // 1. alt属性を追加（まだない場合）
                if (!fullMatch.includes('alt=')) {
                    attributesToAdd.push(`alt=""`);
                    hasChanges = true;
                }
                
                // 2. loading属性を追加（まだない場合）
                if (!fullMatch.includes('loading=')) {
                    attributesToAdd.push(`loading="lazy"`);
                    hasChanges = true;
                }
                
                // 3. width属性を追加（まだない場合）- 2倍サイズなので半分にする
                if (!fullMatch.includes('width=') && dimensions && dimensions.width) {
                    const displayWidth = Math.round(dimensions.width / 2);
                    attributesToAdd.push(`width="${displayWidth}"`);
                    hasChanges = true;
                }
                
                // 4. height属性を追加（まだない場合）- 2倍サイズなので半分にする
                if (!fullMatch.includes('height=') && dimensions && dimensions.height) {
                    const displayHeight = Math.round(dimensions.height / 2);
                    attributesToAdd.push(`height="${displayHeight}"`);
                    hasChanges = true;
                }
                
                // 属性を順序通りに追加
                if (attributesToAdd.length > 0) {
                    newAttrs += ` ${attributesToAdd.join(' ')}`;
                }
                
                // 変更があった場合のみ新しいタグを返す
                if (hasChanges) {
                    processedMatches.push(`<img${newAttrs}>`);
                } else {
                    processedMatches.push(fullMatch);
                }
            }
            
            // 処理されたマッチを元のコンテンツに適用
            let processedContent = content;
            for (let i = 0; i < imgMatches.length; i++) {
                processedContent = processedContent.replace(imgMatches[i][0], processedMatches[i]);
            }
            
            file.contents = Buffer.from(processedContent, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * 行末の半角スペースを削除（空行は保持）
 */
const removeTrailingSpaces = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            const lines = content.split(/\r\n|\r|\n/);
            
            const processedLines = lines.map(line => {
                // 空行（改行のみ）は保持
                if (line === '') {
                    return line;
                }
                // 行末のスペースを削除
                return line.replace(/\s+$/, '');
            });
            
            // CRLF で結合（改行コードを統一）
            content = processedLines.join('\r\n');
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (err) {
            callback(err);
        }
    });
};

/**
 * PHPタグとブロック要素の後に空行を追加（見やすさのため）
 * 既存の空行（複数行含む）は保持する
 */
const addBlankLineAfterPhp = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            
            // PHPタグの後にスペースや改行なしでタグがある場合、改行を追加
            // 例: <?php ... ?> <script → <?php ... ?>\r\n\r\n    <script
            // 例: <?php ... ?><script → <?php ... ?>\r\n\r\n    <script
            const indentSpaces = ' '.repeat(INDENT_SETTINGS.size);
            content = content.replace(/(\?>)[ \t]*(<[a-zA-Z])/g, `$1\r\n\r\n${indentSpaces}$2`);
            
            // PHPタグの後に改行が1つだけある場合、空行を追加（2行以上ある場合は保持）
            // 例: <?php ... ?>\r\n  <main → <?php ... ?>\r\n\r\n  <main
            content = content.replace(/(\?>)(\r\n|\r|\n)([ \t]*)(<[a-zA-Z])/g, (match, phpEnd, newline, spaces, tag) => {
                // 既に複数の改行がある場合はそのまま
                if (match.includes('\r\n\r\n') || match.includes('\n\n') || match.includes('\r\r')) {
                    return match;
                }
                // 1つの改行の場合は空行を追加
                return `${phpEnd}${newline}${newline}${spaces}${tag}`;
            });
            
            // ブロック要素の閉じタグの後に、改行が1つだけで次のタグまたはPHPタグがある場合、空行を追加
            // 対象: section, main, article, aside, header, footer, nav, div, ul, ol, dl, form, table
            // 例: </section>\r\n    <ul → </section>\r\n\r\n    <ul
            // 例: </main>\r\n  <?php → </main>\r\n\r\n  <?php
            // 既に2行以上の改行がある場合、またはHTMLコメントプレースホルダーがある場合は保持
            content = content.replace(
                /(<\/(section|main|article|aside|header|footer|nav|div|ul|ol|dl|form|table)>)((?:\r\n|\r|\n)+)([ \t]*)(<[a-zA-Z?!])/g,
                (match, closeTag, tagName, newlines, spaces, openTag) => {
                    const newlineCount = (newlines.match(/\r\n|\r|\n/g) || []).length;
                    // HTMLコメントプレースホルダーがある場合はそのまま
                    if (openTag === '<!') {
                        return match;
                    }
                    // 既に2行以上の改行がある場合はそのまま
                    if (newlineCount >= 2) {
                        return match;
                    }
                    // 1行の改行の場合は空行を追加
                    return `${closeTag}${newlines}${newlines}${spaces}${openTag}`;
                }
            );
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * 空行を保護（htmlBeautify前）
 * 1行以上の空行をHTMLコメントのプレースホルダーに置き換える
 */
const protectBlankLines = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            const blankLineBlocks = [];
            let blockIndex = 0;
            
            // 1行以上の連続する空行をHTMLコメントプレースホルダーに置き換え
            // 2連続の改行（1行の空行）から保護
            content = content.replace(/((?:\r\n|\r|\n){2,})/g, (match) => {
                const lineCount = (match.match(/\r\n|\r|\n/g) || []).length;
                const placeholder = `<!-- __BLANK_LINES_${blockIndex}_COUNT_${lineCount}__ -->`;
                blankLineBlocks.push({
                    index: blockIndex,
                    lineCount
                });
                blockIndex++;
                // 改行1つ + プレースホルダー + 改行1つ の形式で保存
                return `\r\n${placeholder}\r\n`;
            });
            
            // プレースホルダー情報を保存
            file.blankLineBlocks = blankLineBlocks;
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * htmlBeautifyが自動追加した空行をすべて削除
 * プレースホルダーで保護されている空行以外はすべて削除
 */
const removeAutoBlankLines = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            
            // すべての空行を削除
            // ただし、プレースホルダーを含む行は保持
            const lines = content.split('\r\n');
            const result = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                
                // プレースホルダーを含む行はそのまま追加
                if (trimmed.includes('<!-- __BLANK_LINES_')) {
                    result.push(line);
                }
                // 空行以外は追加
                else if (trimmed !== '') {
                    result.push(line);
                }
                // 空行はスキップ（削除）
            }
            
            content = result.join('\r\n');
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * 空行を復元（htmlBeautify後）
 * プレースホルダーと周囲の改行を元の空行に置き換える
 */
const restoreBlankLines = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            
            // 保存されたプレースホルダー情報を使って復元
            if (file.blankLineBlocks && file.blankLineBlocks.length > 0) {
                file.blankLineBlocks.forEach(block => {
                    const placeholder = `<!-- __BLANK_LINES_${block.index}_COUNT_${block.lineCount}__ -->`;
                    // プレースホルダーとその前後の改行を含めて置き換える
                    // 例: \r\n\r\n<!-- ... -->\r\n → \r\n\r\n\r\n（元の3行の改行）
                    const restored = '\r\n'.repeat(block.lineCount);
                    
                    // プレースホルダーの前後の改行パターンをマッチ
                    const pattern = new RegExp(`((?:\\r\\n|\\r|\\n)*)${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}((?:\\r\\n|\\r|\\n)*)`, 'g');
                    content = content.replace(pattern, restored);
                });
            }
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * PHPタグ周りの改行を保護（htmlBeautify前）
 * 全体の改行情報を保持してから、PHPタグのみを処理
 */
const protectPhpNewlines = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            
            // PHPタグとインデントを保護
            // 行ごとに処理して、PHPタグの行とその前後の空行を記録
            const lines = content.split('\r\n');
            const lineInfo = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                
                // PHPタグを含む行
                if (trimmed.startsWith('<?php') && trimmed.endsWith('?>')) {
                    // 前後の空行をカウント
                    let blankBefore = 0;
                    for (let j = i - 1; j >= 0 && lines[j].trim() === ''; j--) {
                        blankBefore++;
                    }
                    
                    let blankAfter = 0;
                    for (let j = i + 1; j < lines.length && lines[j].trim() === ''; j++) {
                        blankAfter++;
                    }
                    
                    lineInfo.push({
                        index: i,
                        line,
                        blankBefore,
                        blankAfter,
                        isPHP: true
                    });
                }
            }
            
            // PHPタグをプレースホルダーに置き換え
            file.phpLineInfo = lineInfo;
            for (let i = 0; i < lineInfo.length; i++) {
                const info = lineInfo[i];
                const placeholder = `<!-- __PHPLINE_${i}_${info.blankBefore}_${info.blankAfter}__ -->`;
                content = content.replace(info.line, placeholder);
            }
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * PHPタグ周りの改行を復元（htmlBeautify後）
 * HTMLコメントをPHPタグと改行に戻す
 */
const restorePhpNewlines = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            
            // 保存されたPHP行情報を使って復元
            if (file.phpLineInfo && file.phpLineInfo.length > 0) {
                file.phpLineInfo.forEach((info, i) => {
                    const placeholder = `<!-- __PHPLINE_${i}_${info.blankBefore}_${info.blankAfter}__ -->`;
                    
                    // 空行を復元
                    const blankBefore = '\r\n'.repeat(info.blankBefore);
                    const blankAfter = '\r\n'.repeat(info.blankAfter);
                    
                    const restored = `${blankBefore}${info.line}${blankAfter}`;
                    content = content.replace(placeholder, restored);
                });
            }
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * テキストノード内の改行のみを削除（タグ間の改行は保持）
 * htmlBeautifyの代替機能 - テキスト内改行削除のみを行う
 * テキスト間の意図的なスペースは保持する
 */
const removeTextNodeNewlines = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            
            // HTMLコメントを一時的に保護
            const commentPlaceholders = [];
            let commentIndex = 0;
            content = content.replace(/<!--[\s\S]*?-->/g, (comment) => {
                const placeholder = `\x00COMMENT_${commentIndex}\x00`;
                commentPlaceholders.push({ placeholder, comment });
                commentIndex++;
                return placeholder;
            });
            
            // タグで囲まれたテキストノード内の改行を削除
            // >(テキスト)<の部分を処理
            content = content.replace(/>([^<]+)</g, (match, text) => {
                // プレースホルダーを含む場合はスキップ
                if (/\x00COMMENT_\d+\x00/.test(text)) {
                    return match;
                }
                
                // 空白のみ（改行+スペース/タブ）の場合は構造的な改行として保持
                if (/^[\s\r\n]*$/.test(text)) {
                    return match; // そのまま保持
                }
                
                // テキスト内の改行とその前後のインデント（スペース/タブ）を削除
                // 改行をスペースに置換せず、単純に削除する
                let cleaned = text.replace(/[\r\n]+[ \t]*/g, '');
                
                // 連続する複数のスペース/タブを1つにまとめる
                cleaned = cleaned.replace(/[ \t]+/g, ' ');
                
                // 前後の空白を削除
                cleaned = cleaned.trim();
                
                return '>' + cleaned + '<';
            });
            
            // HTMLコメントを復元
            commentPlaceholders.forEach(({ placeholder, comment }) => {
                content = content.replace(placeholder, comment);
            });
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (err) {
            callback(err);
        }
    });
};

/**
 * インデントの整形（htmlBeautifyの代替）
 * 既存の構造（改行）を保持しながら、インデントのみを整形
 */
const formatIndentation = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            const lines = content.split(/\r\n|\r|\n/);
            const indentSize = INDENT_SETTINGS.size;
            let indentLevel = 0;
            const formattedLines = [];
            
            // インデントが増加するタグ（開始タグ）
            const increaseIndentTags = /<(?!\/|!|br|hr|img|input|meta|link)([a-z][a-z0-9]*)\b[^>]*(?<!\/)>/i;
            // インデントが減少するタグ（閉じタグ）
            const decreaseIndentTags = /<\/([a-z][a-z0-9]*)\s*>/i;
            // 自己完結タグ（br, hr, img, input, meta, linkなど）
            const selfClosingTags = /<(br|hr|img|input|meta|link)\b[^>]*>/i;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                
                // 空行はそのまま保持
                if (trimmedLine === '') {
                    formattedLines.push('');
                    continue;
                }
                
                // 閉じタグで始まる場合は先にインデントを減らす
                if (decreaseIndentTags.test(trimmedLine) && !increaseIndentTags.test(trimmedLine)) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }
                
                // インデントを適用
                const indent = ' '.repeat(indentLevel * indentSize);
                formattedLines.push(indent + trimmedLine);
                
                // 開始タグがある場合はインデントを増やす（閉じタグとセットでない場合）
                const hasOpenTag = increaseIndentTags.test(trimmedLine);
                const hasCloseTag = decreaseIndentTags.test(trimmedLine);
                
                if (hasOpenTag && !hasCloseTag) {
                    indentLevel++;
                } else if (hasOpenTag && hasCloseTag) {
                    // 同じ行に開始タグと閉じタグがある場合（<div></div>のような）
                    // インデントは変更しない
                }
            }
            
            // CRLF で結合
            content = formattedLines.join('\r\n');
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (err) {
            callback(err);
        }
    });
};

/**
 * HTMLBeautifyの後処理
 * - <br>タグの後のスペースを削除
 * - 日本語文字間のスペース処理（設定により動作変更可能）
 * - テキスト内の不要なスペースを削除（改行削除時に残ったスペース）
 */
const postBeautifyCleanup = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            
            // <br>タグの直後のスペース（連続したスペースのみ）を削除
            // ただし、テキスト間の意図的なスペースは保持
            // 連続する2つ以上のスペースを削除（インデント由来）
            content = content.replace(/<br>[ \t]{2,}/gi, '<br>');
            
            // テキスト内の複数の連続スペース（改行以外）を1つにする
            // また、改行削除時に残った不要なスペースも削除
            content = content.replace(/>([^<\r\n]+)</g, (match, text) => {
                // 複数スペースを1つにする
                let cleaned = text.replace(/[ \t]{2,}/g, ' ');
                
                // 日本語文字間のスペース処理（設定により動作変更）
                if (JAPANESE_SPACE_REMOVAL.level === 'japanese-only') {
                    // 日本語文字間のスペースを削除（全角文字の間のスペース）
                    // 連続するスペースをすべて削除するため、繰り返し処理
                    while (/([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])\s+([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])/.test(cleaned)) {
                        cleaned = cleaned.replace(/([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])\s+([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])/g, '$1$2');
                    }
                } else if (JAPANESE_SPACE_REMOVAL.level === 'mixed-text') {
                    // 日本語のみの文字列の場合のみスペースを削除
                    // 英数字が含まれている場合はスペースを保持
                    const hasAlphanumeric = /[a-zA-Z0-9]/.test(cleaned);
                    if (!hasAlphanumeric) {
                        // 日本語のみの場合、日本語文字間のスペースを削除
                        // 連続するスペースをすべて削除するため、繰り返し処理
                        while (/([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])\s+([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])/.test(cleaned)) {
                            cleaned = cleaned.replace(/([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])\s+([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])/g, '$1$2');
                        }
                    }
                    // 英数字が含まれている場合はスペースを保持（何もしない）
                } else {
                    // level === 'none' の場合
                    // スペースを保持する（何も処理しない）
                }
                
                return '>' + cleaned + '<';
            });
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (err) {
            callback(err);
        }
    });
};

/**
 * 特殊文字をHTMLエンティティに変換（body内のテキストノードと属性値の両方対象）
 * 既存のエンティティは保持する
 */
const escapeHtmlEntities = () => {
    // 機能が無効な場合はスキップ
    if (!PROJECT_SETTINGS.htmlFormat.enableEntityEscape) {
        return through.obj(function(file, enc, callback) {
            callback(null, file);
        });
    }
    
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }

        try {
            let content = file.contents.toString('utf8');
            
            // エンティティ化処理を共通関数として定義
            const escapeText = (text) => {
                let escapedText = text;
                
                // 必須エンティティ化（HTML構文上のトラブル回避）
                escapedText = escapedText.replace(/&(?![a-zA-Z]+;|#[0-9]+;|#x[0-9a-fA-F]+;)/g, '&amp;');
                escapedText = escapedText.replace(/</g, '&lt;');
                escapedText = escapedText.replace(/>/g, '&gt;');
                escapedText = escapedText.replace(/"/g, '&quot;');
                escapedText = escapedText.replace(/'/g, '&#39;');
                
                // 記号系エンティティ化
                escapedText = escapedText.replace(/©/g, '&copy;');
                escapedText = escapedText.replace(/®/g, '&reg;');
                escapedText = escapedText.replace(/™/g, '&trade;');
                escapedText = escapedText.replace(/…/g, '&hellip;');
                escapedText = escapedText.replace(/–/g, '&ndash;');
                escapedText = escapedText.replace(/—/g, '&mdash;');
                
                // 機種依存文字（丸数字）
                escapedText = escapedText.replace(/①/g, '&#9312;');
                escapedText = escapedText.replace(/②/g, '&#9313;');
                escapedText = escapedText.replace(/③/g, '&#9314;');
                escapedText = escapedText.replace(/④/g, '&#9315;');
                escapedText = escapedText.replace(/⑤/g, '&#9316;');
                escapedText = escapedText.replace(/⑥/g, '&#9317;');
                escapedText = escapedText.replace(/⑦/g, '&#9318;');
                escapedText = escapedText.replace(/⑧/g, '&#9319;');
                escapedText = escapedText.replace(/⑨/g, '&#9320;');
                escapedText = escapedText.replace(/⑩/g, '&#9321;');
                escapedText = escapedText.replace(/⑪/g, '&#9322;');
                escapedText = escapedText.replace(/⑫/g, '&#9323;');
                escapedText = escapedText.replace(/⑬/g, '&#9324;');
                escapedText = escapedText.replace(/⑭/g, '&#9325;');
                escapedText = escapedText.replace(/⑮/g, '&#9326;');
                escapedText = escapedText.replace(/⑯/g, '&#9327;');
                escapedText = escapedText.replace(/⑰/g, '&#9328;');
                escapedText = escapedText.replace(/⑱/g, '&#9329;');
                escapedText = escapedText.replace(/⑲/g, '&#9330;');
                escapedText = escapedText.replace(/⑳/g, '&#9331;');
                
                // 機種依存文字（ローマ数字）
                escapedText = escapedText.replace(/Ⅰ/g, '&#8544;');
                escapedText = escapedText.replace(/Ⅱ/g, '&#8545;');
                escapedText = escapedText.replace(/Ⅲ/g, '&#8546;');
                escapedText = escapedText.replace(/Ⅳ/g, '&#8547;');
                escapedText = escapedText.replace(/Ⅴ/g, '&#8548;');
                escapedText = escapedText.replace(/Ⅵ/g, '&#8549;');
                escapedText = escapedText.replace(/Ⅶ/g, '&#8550;');
                escapedText = escapedText.replace(/Ⅷ/g, '&#8551;');
                escapedText = escapedText.replace(/Ⅸ/g, '&#8552;');
                escapedText = escapedText.replace(/Ⅹ/g, '&#8553;');
                escapedText = escapedText.replace(/Ⅺ/g, '&#8554;');
                escapedText = escapedText.replace(/Ⅻ/g, '&#8555;');
                
                // 機種依存文字（特殊合字）
                escapedText = escapedText.replace(/㈱/g, '&#12977;');
                escapedText = escapedText.replace(/㍻/g, '&#13069;');
                escapedText = escapedText.replace(/㌔/g, '&#13012;');
                escapedText = escapedText.replace(/㍉/g, '&#13065;');
                escapedText = escapedText.replace(/㌢/g, '&#13026;');
                escapedText = escapedText.replace(/㌍/g, '&#13005;');
                escapedText = escapedText.replace(/㌘/g, '&#13016;');
                escapedText = escapedText.replace(/㌧/g, '&#13031;');
                escapedText = escapedText.replace(/㌃/g, '&#12995;');
                escapedText = escapedText.replace(/㌶/g, '&#13014;');
                escapedText = escapedText.replace(/㍑/g, '&#13073;');
                escapedText = escapedText.replace(/㍗/g, '&#13079;');
                escapedText = escapedText.replace(/㌕/g, '&#13013;');
                escapedText = escapedText.replace(/㌫/g, '&#13035;');
                escapedText = escapedText.replace(/㍊/g, '&#13066;');
                escapedText = escapedText.replace(/㌻/g, '&#13019;');
                
                // その他（ノーブレークスペース）
                escapedText = escapedText.replace(/\u00A0/g, '&nbsp;');
                
                return escapedText;
            };
            
            // まず全体のPHPコードを一時的に保護
            const globalPhpPlaceholders = [];
            let globalPhpIndex = 0;
            
            let globalPhpProtectedContent = content.replace(/<\?php[\s\S]*?\?>/gi, (php) => {
                const placeholder = `\x00GLOBAL_PHP_PH_${globalPhpIndex}\x00`;
                globalPhpPlaceholders.push({ placeholder, php });
                globalPhpIndex++;
                return placeholder;
            });
            
            // body内のテキストコンテンツと属性値を対象にエンティティ変換
            globalPhpProtectedContent = globalPhpProtectedContent.replace(/<body([^>]*)>([\s\S]*?)<\/body>/gi, (match, bodyAttrs, bodyContent) => {
                // HTMLコメントとタグを保護してからテキストをエンティティ化
                const commentPlaceholders = [];
                let commentIndex = 0;
                const tagPlaceholders = [];
                let tagIndex = 0;
                
                // 1. HTMLコメントを一時的に保護
                let protectedContent = bodyContent.replace(/<!--[\s\S]*?-->/g, (comment) => {
                    const placeholder = `\x00COMMENT_PH_${commentIndex}\x00`;
                    commentPlaceholders.push({ placeholder, comment });
                    commentIndex++;
                    return placeholder;
                });
                
                // 2. HTMLタグを一時的に保護
                protectedContent = protectedContent.replace(/<\/?[a-zA-Z][^>]*>/g, (tag) => {
                    const placeholder = `\x00TAG_PH_${tagIndex}\x00`;
                    tagPlaceholders.push({ placeholder, tag });
                    tagIndex++;
                    return placeholder;
                });
                
                // 3. 保護されたコンテンツ内のテキストをエンティティ化
                const escapedContent = escapeText(protectedContent);
                
                // 4. タグを元に戻す（属性値はエンティティ化）
                let restoredContent = escapedContent;
                tagPlaceholders.forEach(({ placeholder, tag }) => {
                    const processedTag = tag.replace(/(\w+)\s*=\s*["']([^"']*?)["']/g, (attrMatch, attrName, attrValue) => {
                        const escapedAttrValue = escapeText(attrValue);
                        return `${attrName}="${escapedAttrValue}"`;
                    });
                    restoredContent = restoredContent.replace(placeholder, processedTag);
                });
                
                // 5. コメントを元に戻す（コメント内は変更しない）
                commentPlaceholders.forEach(({ placeholder, comment }) => {
                    restoredContent = restoredContent.replace(placeholder, comment);
                });
                
                return `<body${bodyAttrs}>${restoredContent}</body>`;
            });
            
            // 4. 全体のPHPコードを元に戻す
            let finalContent = globalPhpProtectedContent;
            globalPhpPlaceholders.forEach(({ placeholder, php }) => {
                finalContent = finalContent.replace(placeholder, php);
            });
            
            content = finalContent;
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * ファイル末尾に空行を1行追加
 */
const addTrailingNewline = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }

        try {
            let content = file.contents.toString('utf8');
            
            // ファイルが空行で終わっていない場合は追加
            if (content && !content.endsWith('\n') && !content.endsWith('\r\n')) {
                content += '\r\n';
            }
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * 変更がない場合は書き出しをスキップ（watch無限ループ抑止）
 */
const filterUnchanged = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) return callback();
        if (file.isStream()) return callback(new Error('Streaming not supported'));
        try {
            if (fs.existsSync(file.path)) {
                const before = fs.readFileSync(file.path, 'utf8');
                const after = file.contents.toString('utf8');
                if (before === after) {
                    return callback();
                }
            }
            this.push(file);
            callback();
        } catch (e) {
            this.push(file);
            callback();
        }
    });
};

/**
 * エディターにファイル変更を確実に通知するためにタイムスタンプを更新
 */
const notifyEditorFileChange = () => {
    const filesToUpdate = [];
    
    return through.obj(
        function transform(file, enc, callback) {
            if (file.isNull()) {
                return callback(null, file);
            }
            if (file.isStream()) {
                return callback(new Error('Streaming not supported'));
            }
            
            // ファイルパスを記録
            filesToUpdate.push(file.path);
            callback(null, file);
        },
        function flush(callback) {
            // すべてのファイル処理が完了した後にタイムスタンプを更新
            // 少し遅延させてファイルシステムの書き込みを確実に完了させる
            setTimeout(() => {
                filesToUpdate.forEach(filePath => {
                    try {
                        if (fs.existsSync(filePath)) {
                            const now = new Date();
                            fs.utimesSync(filePath, now, now);
                        }
                    } catch (error) {
                        // エラーは無視
                    }
                });
                callback();
            }, 100);
        }
    );
};

/**
 * 改行コードをCRLFに統一（改行は保持）
 */
const normalizeLineEndings = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }

        try {
            let content = file.contents.toString('utf8');
            
            // 改行コードをCRLFに統一（改行は保持）
            content = content.replace(/\r\n|\r|\n/g, '\r\n');
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * 自己完結タグの /> を削除
 */
const removeSelfClosingSlashes = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            
            // 自己閉じタグのスラッシュを削除
            content = content.replace(/(<(?:meta|link|img|br|hr|input|area|base|col|embed|source|track|wbr)[^>]*?)\s*\/>/gi, '$1>');
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (err) {
            callback(err);
        }
    });
};

/**
 * 閉じタグ直前の半角スペースを削除（全タグ共通）
 * 注意: 文章中のスペース（閉じタグ直前以外）は保持されます
 */
const removeSpacesBeforeClosingTag = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            
            // 1) 実体 &nbsp; を閉じタグ直前で除去（ただし行頭のインデントは保持）
            //    改行やスペース・タブ以外の文字の後にある &nbsp; のみを削除
            content = content.replace(/([^\r\n \t])(&nbsp;)+(?=<\/[a-zA-Z][\w:-]*>)/g, '$1');
            
            // 2) 各種スペース（半角/タブ/NBSP/全角/ゼロ幅等）を閉じタグ直前で除去
            //    文章中のスペース（閉じタグ直前以外）は保持される
            //    ただし、行頭のインデントは保持（改行やスペース・タブ以外の文字の後にあるスペースのみを削除）
            content = content.replace(/([^\r\n \t])[ \t\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]+(?=<\/[a-zA-Z][\w:-]*>)/g, '$1');
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (err) {
            callback(err);
        }
    });
};

/**
 * scriptタグとlinkタグの不要な属性を削除
 * @param {Object} options - 設定オプション
 * @param {boolean} options.removeScriptType - scriptタグのtype="text/javascript"を削除するか
 * @param {boolean} options.removeScriptLanguage - scriptタグのlanguage="javascript"を削除するか
 * @param {boolean} options.removeLinkType - linkタグのtype="text/css"を削除するか
 * @param {boolean} options.removeEmptyAttributes - 空の属性値を削除するか
 * @param {boolean} options.removeDuplicateAttributes - 重複する属性を削除するか
 */
const cleanScriptAndLinkTags = (options = {}) => {
    // デフォルト設定
    const defaultOptions = {
        removeScriptType: true,
        removeScriptLanguage: true,
        removeLinkType: true,
        removeEmptyAttributes: true,
        removeDuplicateAttributes: true
    };
    
    const config = { ...defaultOptions, ...options };
    
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }

        try {
            let content = file.contents.toString('utf8');
            
            // scriptタグの不要な属性を削除
            if (config.removeScriptType || config.removeScriptLanguage) {
                content = content.replace(/<script([^>]*?)>/gi, (match, attrs) => {
                    let cleanAttrs = attrs;
                    
                    // type="text/javascript" を削除（HTML5では不要）
                    if (config.removeScriptType) {
                        cleanAttrs = cleanAttrs.replace(/\s+type\s*=\s*["']text\/javascript["']/gi, '');
                    }
                    
                    // language="javascript" を削除（非推奨）
                    if (config.removeScriptLanguage) {
                        cleanAttrs = cleanAttrs.replace(/\s+language\s*=\s*["']javascript["']/gi, '');
                    }
                    
                    // 連続する空白を1つにまとめる
                    cleanAttrs = cleanAttrs.replace(/\s+/g, ' ').trim();
                    
                    // 属性の前にスペースを追加（属性がある場合のみ）
                    if (cleanAttrs) {
                        cleanAttrs = ' ' + cleanAttrs;
                    }
                    
                    return `<script${cleanAttrs}>`;
                });
            }
            
            // linkタグの不要な属性を削除
            if (config.removeLinkType) {
                content = content.replace(/<link([^>]*?)>/gi, (match, attrs) => {
                    // type="text/css" を削除（CSSファイルでは不要）
                    let cleanAttrs = attrs.replace(/\s+type\s*=\s*["']text\/css["']/gi, '');
                    
                    // 連続する空白を1つにまとめる
                    cleanAttrs = cleanAttrs.replace(/\s+/g, ' ').trim();
                    
                    // 属性の前にスペースを追加（属性がある場合のみ）
                    if (cleanAttrs) {
                        cleanAttrs = ' ' + cleanAttrs;
                    }
                    
                    return `<link${cleanAttrs}>`;
                });
            }
            
            // 空の属性値を削除（例：class=""）
            if (config.removeEmptyAttributes) {
                content = content.replace(/\s+([\w-]+)\s*=\s*["']\s*["']/gi, '');
            }
            
            // 重複する属性を削除（最初のもの以外を削除）
            if (config.removeDuplicateAttributes) {
                content = content.replace(/<(\w+)([^>]*?)>/gi, (match, tagName, attrs) => {
                    const attrMap = new Map();
                    const booleanAttrs = new Set();
                    
                    // 値を持つ属性を抽出（name="value" 形式）
                    const attrRegex = /([\w-]+)\s*=\s*["']([^"']*?)["']/gi;
                    let attrMatch;
                    
                    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
                        const [, attrName, attrValue] = attrMatch;
                        if (!attrMap.has(attrName)) {
                            attrMap.set(attrName, attrValue);
                        }
                    }
                    
                    // ブール属性（値を持たない属性）を抽出
                    let attrsWithoutValues = attrs;
                    // 値を持つ属性を一時的に削除
                    attrsWithoutValues = attrsWithoutValues.replace(/([\w-]+)\s*=\s*["'][^"']*["']/gi, '');
                    // 残った単語（ブール属性）を抽出
                    const booleanAttrMatches = attrsWithoutValues.match(/\b[\w-]+\b/g);
                    if (booleanAttrMatches) {
                        booleanAttrMatches.forEach(attr => booleanAttrs.add(attr));
                    }
                    
                    // 重複を除いた属性を再構築
                    const cleanAttrsList = [];
                    
                    // 値を持つ属性を追加
                    Array.from(attrMap.entries()).forEach(([name, value]) => {
                        cleanAttrsList.push(`${name}="${value}"`);
                    });
                    
                    // ブール属性を追加
                    Array.from(booleanAttrs).forEach(attr => {
                        cleanAttrsList.push(attr);
                    });
                    
                    // 属性を半角スペース1つで結合
                    const allAttrs = cleanAttrsList.join(' ');
                    
                    return allAttrs ? `<${tagName} ${allAttrs}>` : `<${tagName}>`;
                });
            }
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * HTML内の改行を正規化（タグ内のテキスト改行のみを削除）
 */
const normalizeHtmlLineBreaks = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }

        try {
            let content = file.contents.toString('utf8');
            
            // <head>タグ内は除外して、<body>タグ内のブロック要素のみを対象に改行を正規化
            // タグ間の改行は保持し、タグ内のテキスト改行のみを削除
            
            // <body>タグ内のブロック要素内のテキスト改行を削除
            content = content.replace(/<body([^>]*)>([\s\S]*?)<\/body>/gi, (match, bodyAttrs, bodyContent) => {
                // body内の全要素を対象に改行正規化（ただし一部タグは除外）
                const normalizedBodyContent = bodyContent.replace(/<([a-zA-Z][\w:-]*)([^>]*)>([\s\S]*?)<\/\1>/gi, (innerMatch, tagName, attrs, innerContent) => {
                    const lowerTag = tagName.toLowerCase();
                    // script/style/pre/textarea/code/table関連/リスト関連は除外（構造要素）
                    if (["script", "style", "pre", "textarea", "code", "table", "tbody", "thead", "tfoot", "tr", "td", "th", "ul", "ol", "dl", "li", "dt", "dd"].includes(lowerTag)) {
                        return innerMatch;
                    }
                    
                    // ブロック要素（構造的な要素）を含むかチェック
                    // インライン要素（br, span, a, strong, em など）は無視
                    const blockElementPattern = /<(div|section|article|header|footer|nav|aside|main|form|fieldset|figure|iframe|video|audio|canvas|svg|p|h[1-6]|blockquote|address)[^>]*>/i;
                    const hasBlockElements = blockElementPattern.test(innerContent);
                    
                    // ブロック要素を含む場合は、改行を保持（構造的な要素として扱う）
                    if (hasBlockElements) {
                        return innerMatch;
                    }
                    
                    // テキストのみの場合は改行を削除
                    // 1) HTMLコメントとタグを一時退避（<br>含む）
                    const tagPlaceholders = [];
                    let index = 0;
                    
                    // まずHTMLコメントを保護
                    let protectedContent = innerContent.replace(/<!--[\s\S]*?-->/g, (comment) => {
                        const ph = `\x00TAG_PH_${index}\x00`;
                        tagPlaceholders.push({ ph, tag: comment });
                        index++;
                        return ph;
                    });
                    
                    // 次に通常のタグを保護
                    protectedContent = protectedContent.replace(/<\/?[^>]+>/g, (tag) => {
                        const ph = `\x00TAG_PH_${index}\x00`;
                        tagPlaceholders.push({ ph, tag });
                        index++;
                        return ph;
                    });
                    
                    // 2) プレースホルダで分割し、テキスト片のみ改行除去
                    const parts = protectedContent.split(/(\x00TAG_PH_\d+\x00)/g);
                    let rebuilt = '';
                    for (const part of parts) {
                        const phItem = tagPlaceholders.find(t => t.ph === part);
                        if (phItem) {
                            rebuilt += phItem.tag;
                        } else {
                            // テキスト片: 何かしら非空白文字が含まれる場合のみ改行除去
                            if (/[\S]/.test(part)) {
                                rebuilt += part
                                    // 改行と直後のインデント（半角スペース/タブ）を同時に除去
                                    .replace(/(?:\r\n|\r|\n)[\t ]+/g, '')
                                    // 残った改行単体も除去
                                    .replace(/\r\n|\r|\n/g, '');
                            } else {
                                // タグ間の空白・改行はそのまま保持
                                rebuilt += part;
                            }
                        }
                    }
                    
                    // 3) 末尾の半角スペースのみを削除（全角や改行は保持）
                    const trimmedEndSpaces = rebuilt.replace(/ +$/g, '');
                    
                    return `<${tagName}${attrs}>${trimmedEndSpaces}</${tagName}>`;
                });
                
                return `<body${bodyAttrs}>${normalizedBodyContent}</body>`;
            });
            
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (error) {
            callback(error);
        }
    });
};

/**
 * 閉じタグを正しいインデント位置に配置
 * 戦略: 行頭の閉じタグを検出し、対応する開始タグと同じインデントを付与
 */
const fixClosingTagIndent = () => {
    return through.obj(function(file, enc, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }
        if (file.isStream()) {
            return callback(new Error('Streaming not supported'));
        }
        try {
            let content = file.contents.toString('utf8');
            const lines = content.split('\r\n');
            const result = [];
            const tagStack = []; // {tagName, indent}
            
            for (const line of lines) {
                const trimmed = line.trim();
                const currentIndent = line.match(/^[ \t]*/)?.[0] || '';
                
                // 同じ行に開始タグと閉じタグがある場合はスタック操作をスキップ
                const hasBothTags = /<([a-zA-Z][\w:-]*)(?:\s[^>]*)?>[\s\S]*<\/\1>/.test(trimmed);
                if (hasBothTags) {
                    result.push(line);
                    continue;
                }
                
                // 開始タグのみの行を検出
                const openTagMatch = trimmed.match(/^<([a-zA-Z][\w:-]*)(?:\s[^>]*)?>$/);
                if (openTagMatch && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
                    tagStack.push({ tagName: openTagMatch[1], indent: currentIndent });
                    result.push(line);
                    continue;
                }
                
                // 閉じタグのみの行
                const closeTagMatch = trimmed.match(/^<\/([a-zA-Z][\w:-]*)>$/);
                if (closeTagMatch) {
                    const tagName = closeTagMatch[1];
                    // スタックから対応する開始タグを後ろから検索
                    let foundIndex = -1;
                    for (let i = tagStack.length - 1; i >= 0; i--) {
                        if (tagStack[i].tagName === tagName) {
                            foundIndex = i;
                            break;
                        }
                    }
                    
                    if (foundIndex >= 0) {
                        const matchedTag = tagStack[foundIndex];
                        result.push(`${matchedTag.indent}${trimmed}`);
                        tagStack.splice(foundIndex, 1);
                    } else {
                        // 対応する開始タグが見つからない場合は、直前の子要素のインデントから設定されたサイズ分減らす
                        let prevIndent = '';
                        if (result.length > 0) {
                            const prevLine = result[result.length - 1];
                            const prevLineIndent = prevLine.match(/^[ \t]*/)?.[0] || '';
                            if (prevLineIndent.length >= INDENT_SETTINGS.size) {
                                prevIndent = prevLineIndent.substring(INDENT_SETTINGS.size);
                            }
                        }
                        result.push(`${prevIndent}${trimmed}`);
                    }
                    continue;
                }
                
                // その他の行
                result.push(line);
            }
            
            content = result.join('\r\n');
            file.contents = Buffer.from(content, 'utf8');
            callback(null, file);
        } catch (err) {
            callback(err);
        }
    });
};

/**
 * HTML/PHPファイルの自動フォーマット処理
 */
export const formatHtml = () => {
    // HTML/PHPフォーマット処理が無効な場合はスキップ
    if (!PROJECT_SETTINGS.enableHtmlFormat) {
        return Promise.resolve();
    }
    
    let stream = gulp.src(paths.html.src, { 
        base: './',
        ignore: paths.html.exclude 
    })
        .pipe(plumber({ errorHandler: notify.onError('Error: <%= error.message %>') }))
        // 注意: エンコーディングチェックは 'gulp checkEncoding' タスクで別途実行してください
        .pipe(normalizeLineEndings())
        .pipe(removeSelfClosingSlashes());
    
    // script/linkタグのクリーンアップ
    if (PROJECT_SETTINGS.htmlFormat.enableScriptLinkCleanup) {
        stream = stream.pipe(cleanScriptAndLinkTags(HTML_CLEANUP_OPTIONS));
    }
    
    // インデント整形
    if (PROJECT_SETTINGS.htmlFormat.enableIndentFormat) {
        stream = stream.pipe(formatIndentation());
    }
    
    // テキストノード内の改行削除
    if (PROJECT_SETTINGS.htmlFormat.enableTextNodeCleanup) {
        stream = stream.pipe(removeTextNodeNewlines());
    }
    
    stream = stream
        .pipe(postBeautifyCleanup()) // テキストのスペース処理
        .pipe(removeSpacesBeforeClosingTag())
        .pipe(addImageAttributes()) // 内部で設定チェック済み
        .pipe(escapeHtmlEntities()); // 内部で設定チェック済み
    
    // 行末スペース削除
    if (PROJECT_SETTINGS.htmlFormat.enableTrailingSpaceRemoval) {
        stream = stream.pipe(removeTrailingSpaces());
    }
    
    return stream
        .pipe(addTrailingNewline())
        .pipe(filterUnchanged())
        .pipe(gulp.dest(paths.html.dest))
        .pipe(notifyEditorFileChange()); // エディターに変更を通知
};

// --- 画像タスク ---
/**
 * JPG、PNG、GIF画像を最適化
 * 注意: 主な目標がWebP変換の場合は、このタスクはオプションです
 */
export const imagesOptimize = (options = {}) => {
    return new Promise(async (resolve) => {
        const compressed = loadCompressedJson();
        const projectRoot = process.cwd();
        const toRel = file => path.relative(projectRoot, file);
        
        // 強制再圧縮フラグを設定
        forceRecompress = options.force || false;
        
        // JSONファイルの変更をチェック（強制再圧縮時のみ）
        let jsonChanged = false;
        if (forceRecompress) {
            try {
                const jsonStat = fs.statSync(COMPRESSED_JSON);
                const currentJsonMtime = jsonStat.mtimeMs;
                if (currentJsonMtime > lastJsonMtime) {
                    jsonChanged = true;
                    lastJsonMtime = currentJsonMtime;
                    console.log('[画像圧縮] JSONファイルの変更を検知しました');
                }
            } catch (e) {
                // JSONファイルが存在しない場合は無視
            }
        }
        // JPG/PNG/GIFファイルとWebPファイルの両方を対象にする
        const jpgFiles = (await glob.glob(paths.images.src)).map(toRel);
        const webpFiles = (await glob.glob(`wp-content/themes/${THEME_NAME}/assets/img/**/*.webp`)).map(toRel);
        const files = [...jpgFiles, ...webpFiles];

        // 特定ファイル指定がある場合はフィルタ
        let targetFiles = files;
        if (options.file) {
            const targetFile = options.file;
            targetFiles = files.filter(file => {
                return file.includes(targetFile) || file.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp').includes(targetFile);
            });
            if (targetFiles.length === 0) {
                console.log(`[画像圧縮] 指定されたファイルが見つかりません: ${targetFile}`);
                return resolve();
            }
            console.log(`[画像圧縮] 指定ファイルのみを処理: ${targetFiles.length}件`);
        }

        // 圧縮対象ファイルをフィルタ
        const targets = targetFiles.filter(file => {
            const webpPath = file.endsWith('.webp') ? file : file.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
            const fileData = compressed[webpPath];
            
            // 強制再圧縮モードの場合
            if (forceRecompress || jsonChanged || options.file) {
                // forceAllオプションがtrueの場合はすべて対象（falseも含む）
                if (options.forceAll) {
                    console.log(`[強制再圧縮] ${file}: forceAll=true`);
                    return true;
                }
                
                // recompress: false の場合は除外
                if (fileData && fileData.recompress === false) {
                    console.log(`[除外] ${file}: recompress=false`);
                    return false;
                }
                
                // includeUndefinedオプションがtrueの場合は未設定も対象
                if (options.includeUndefined) {
                    console.log(`[再圧縮対象] ${file}: includeUndefined=true`);
                    return true;
                }
                
                // recompress: trueのファイルのみを対象にする
                if (fileData && fileData.recompress === true) {
                    console.log(`[再圧縮対象] ${file}: recompress=true`);
                    return true;
                }
                
                // recompressが設定されていない場合
                if (!fileData || fileData.recompress === undefined) {
                    // rc-allコマンドの場合は対象にする
                    if (!options.respectFlag) {
                        console.log(`[再圧縮対象] ${file}: recompress未設定（-all）`);
                        return true;
                    }
                    // 通常のrcコマンドの場合は除外
                    console.log(`[除外] ${file}: recompress未設定`);
                    return false;
                }
                
                return false;
            }
            
            // WebPファイルの場合はそのまま判定
            if (file.endsWith('.webp')) {
                if (compressed[file] && compressed[file].fileHash) {
                    // ハイブリッド方式でファイルが変更されているかチェック
                    const filePath = path.join(projectRoot, file);
                    if (!isFileChanged(filePath, compressed[file])) {
                        // ファイルが変更されていない場合はスキップ
                        return false;
                    }
                }
                return true;
            }
            // JPG/PNG/GIFファイルの場合はWebPパスで判定
            else {
                const webpPath = file.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
                if (compressed[webpPath] && compressed[webpPath].fileHash) {
                    // ハイブリッド方式でファイルが変更されているかチェック
                    const filePath = path.join(projectRoot, file);
                    if (!isFileChanged(filePath, compressed[webpPath])) {
                        // ファイルが変更されていない場合はスキップ
                        return false;
                    }
                }
                return true;
            }
        });

        if (targets.length === 0) {
            console.log('[画像圧縮] 新規圧縮対象なし');
            saveCompressedJson(compressed);
            return resolve();
        }


        for (const file of targets) {
            const filePath = path.join(projectRoot, file);
            
            try {
                // BMPファイルがまだ残っている場合（変換されていない場合）はスキップ
                if (file.toLowerCase().endsWith('.bmp')) {
                    if (compressed[file]) {
                        // JSONに記録されているBMPファイルは処理済みとして除外
                        continue;
                    }
                    
                    console.log(`⏭️ [画像圧縮] BMPファイルはPNG変換後に処理してください: ${file}`);
                    
                    // BMPファイルを処理済みとしてJSONに記録（元のファイル名で記録）
                    const stat = fs.statSync(filePath);
                    const fileHash = calculateFileHash(filePath, stat);
                    const mtimeMs = stat.mtimeMs || stat.mtime * 1000;
                    if (fileHash) {
                        compressed[file] = {
                            fileHash,
                            mtimeMs,
                            manual: false,
                            compressionLevel: 'low'
                        };
                    }
                    continue;
                }
                
                const beforeMetadata = await getImageMetadata(filePath);
                
                if (beforeMetadata.error) {
                    console.error(`❌ [画像圧縮] 処理失敗: ${file} - ${beforeMetadata.error}`);
                    continue;
                }
                
                // GIFの場合はアニメーションかどうかチェック（スキップ済みでない場合のみ）
                if (file.endsWith('.gif')) {
                    if (compressed[file]) {
                        // JSONに記録されているGIFファイルは処理済みとして除外
                        continue;
                    }
                    
                    // スキップ記録がない場合、新しくチェック
                    try {
                        const metadata = await sharp(filePath).metadata();
                        if (metadata.pages && metadata.pages > 1) {
                            // 処理済みとしてJSONに記録（元のファイル名で記録）
                            const stat = fs.statSync(filePath);
                            const fileHash = calculateFileHash(filePath, stat);
                            const mtimeMs = stat.mtimeMs || stat.mtime * 1000;
                            if (fileHash) {
                                compressed[file] = {
                                    fileHash,
                                    mtimeMs,
                                    manual: false,
                                    compressionLevel: 'low'
                                };
                                
                                // JSONを即座に保存
                                saveCompressedJson(compressed);
                                console.log(`⏭️ [画像圧縮] アニメーションGIFをスキップ: ${file} (${metadata.pages}フレーム)`);
                            }
                            continue;
                        }
                    } catch (gifError) {
                        console.error(`❌ [画像圧縮] GIFファイルの読み込みエラー: ${file} - ${gifError.message}`);
                        
                        // GIFファイル読み込みエラー時もJSONに記録（元のファイル名で記録）
                        const stat = fs.statSync(filePath);
                        const fileHash = calculateFileHash(filePath, stat);
                        const mtimeMs = stat.mtimeMs || stat.mtime * 1000;
                        if (fileHash) {
                            compressed[file] = {
                                fileHash,
                                mtimeMs,
                                manual: false,
                                compressionLevel: 'low'
                            };
                            saveCompressedJson(compressed);
                        }
                        continue;
                    }
                }
                
                const originalSize = fs.statSync(filePath).size;
                
                // ファイルの圧縮レベルを取得（デフォルトはlow）
                let compressionLevel = 'low';
                if (file.endsWith('.webp')) {
                    compressionLevel = compressed[file]?.compressionLevel || 'low';
                } else {
                    const webpPath = file.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
                    compressionLevel = compressed[webpPath]?.compressionLevel || 'low';
                }
                
                const settings = getCompressionSettings(compressionLevel);
                
                // バックアップファイルを作成
                const backupPath = filePath + '.backup';
                fs.copyFileSync(filePath, backupPath);
                
                // ファイル形式に応じて適切な圧縮処理を選択
                if (file.endsWith('.png')) {
                    // 一時ファイルを使用して同じファイルを入力・出力に使用する問題を回避
                    const tempPath = filePath + '.tmp';
                    await sharp(filePath)
                        .png({ 
                            quality: Math.round(settings.png.quality[1] * 100),
                            compressionLevel: 6,
                            adaptiveFiltering: true,
                            force: true
                        })
                        .toFile(tempPath);
                    
                    // 一時ファイルを元のファイルに移動
                    fs.renameSync(tempPath, filePath);
                } else if (file.endsWith('.webp')) {
                    // WebPファイルの圧縮処理
                    const tempPath = filePath + '.tmp';
                    await sharp(filePath)
                        .webp({ 
                            quality: settings.webp.quality,
                            force: true
                        })
                        .toFile(tempPath);
                    
                    // 一時ファイルを元のファイルに移動
                    fs.renameSync(tempPath, filePath);
                } else {
                    // JPG/GIFファイルは従来通りimageminを使用
                    await new Promise((res, rej) => {
                        gulp.src(filePath)
                            .pipe(plumber({ errorHandler: notify.onError('Error: <%= error.message %>') }))
                            .pipe(imagemin([
                                imageminMozjpeg(settings.jpeg),
                                imageminGifsicle(settings.gif)
                            ]))
                            .pipe(gulp.dest(path.dirname(filePath)))
                            .on('end', res)
                            .on('error', rej);
                    });
                }
                
                // 処理後の検証
                const isValid = await logImageComparison(backupPath, filePath, `画像圧縮 (${compressionLevel})`);
                
                if (!isValid) {
                    console.error(`❌ [画像圧縮] 処理失敗: ${file}`);
                    // バックアップから復元
                    fs.copyFileSync(backupPath, filePath);
                    failedFiles.add(file);
                    // バックアップファイルを削除
                    if (fs.existsSync(backupPath)) {
                        fs.unlinkSync(backupPath);
                    }
                    continue;
                }
                
                const compressedSize = fs.statSync(filePath).size;
                const change = ((compressedSize - originalSize) / originalSize * 100);
                const changeText = change >= 0 ? `${change.toFixed(1)}% 増加` : `${Math.abs(change).toFixed(1)}% 削減`;
                
                // ファイルサイズを読みやすい形式に変換
                const formatSize = (bytes) => {
                    if (bytes >= 1024) {
                        return (bytes / 1024).toFixed(1) + 'KB';
                    }
                    return bytes + 'B';
                };
                
                
                // バックアップファイルを削除
                if (fs.existsSync(backupPath)) {
                    fs.unlinkSync(backupPath);
                }
                
                // ファイルのハッシュとmtimeMsを取得（ハイブリッド方式用）
                const stat = fs.statSync(filePath);
                const fileHash = calculateFileHash(filePath, stat);
                const mtimeMs = stat.mtimeMs || stat.mtime * 1000;
                
                if (!fileHash) {
                    console.error(`❌ [画像圧縮] ハッシュ計算失敗: ${file}`);
                    continue;
                }
                
                // WebPファイルの場合はそのまま記録、JPG/PNG/GIFの場合はWebPパスで記録
                if (file.endsWith('.webp')) {
                    // recompressフラグがtrueだった場合はリセット（undefinedに）
                    const wasRecompress = compressed[file]?.recompress === true;
                    compressed[file] = { fileHash, mtimeMs, manual: false, compressionLevel };
                    if (wasRecompress) {
                        console.log(`[recompressフラグリセット] ${file}`);
                    }
                    
                    // WebPファイルの再圧縮時にもログを表示
                    if (originalSize) {
                        const change = ((compressedSize - originalSize) / originalSize * 100);
                        const changeText = change >= 0 ? `${change.toFixed(1)}% 増加` : `${Math.abs(change).toFixed(1)}% 削減`;
                        const formatSize = (bytes) => {
                            if (bytes >= 1024) {
                                return (bytes / 1024).toFixed(1) + 'KB';
                            }
                            return bytes + 'B';
                        };
                        console.log(`✅ ${file}: ${formatSize(originalSize)} → ${formatSize(compressedSize)} (${changeText}) [${compressionLevel}]`);
                    }
                } else {
                    const webpPath = file.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
                    // recompressフラグがtrueだった場合はリセット（undefinedに）
                    const wasRecompress = compressed[webpPath]?.recompress === true;
                    compressed[webpPath] = { 
                        fileHash,
                        mtimeMs,
                        manual: false, 
                        compressionLevel,
                        originalSize: originalSize
                    };
                    if (wasRecompress) {
                        console.log(`[recompressフラグリセット] ${webpPath}`);
                    }
                }
            } catch (e) {
                console.error(`❌ [画像圧縮] 失敗: ${file}`, e.message);
                console.error('スタックトレース:', e.stack);
                failedFiles.add(file);
                // エラー時もバックアップファイルと一時ファイルを削除
                const backupPath = filePath + '.backup';
                const tempPath = filePath + '.tmp';
                if (fs.existsSync(backupPath)) {
                    fs.unlinkSync(backupPath);
                }
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                }
            }
        }

        saveCompressedJson(compressed);
        resolve();
    });
};

/**
 * BMP/TIFF/GIFファイルをPNGに変換（Sharp使用）
 */
export const convertBmpTiff = () => {
    return new Promise(async (resolve) => {
        const compressed = loadCompressedJson();
        const projectRoot = process.cwd();
        const toRel = file => path.relative(projectRoot, file);
        const allFiles = (await glob.glob(`wp-content/themes/${THEME_NAME}/assets/img/**/*.{bmp,tiff,gif}`)).map(toRel);
        
        if (allFiles.length === 0) {
            return resolve();
        }
        
        // 実際に処理するファイルのみをフィルタ（スキップ済みは除外）
        const files = [];
        const skippedFiles = [];
        
        for (const file of allFiles) {
            const pngFile = file.replace(/\.(bmp|tiff|gif)$/i, '.png');
            
            // 処理中のファイルはスキップ
            if (processingFiles.has(file) || processingFiles.has(pngFile)) {
                continue;
            }
            
            // 既存のPNGファイルがある場合はスキップ
            if (fs.existsSync(path.join(projectRoot, pngFile))) {
                continue;
            }
            
            // BMPファイルが既に処理済みかチェック（JSONに記録されている場合）
            if (file.toLowerCase().endsWith('.bmp')) {
                if (compressed[file]) {
                    // JSONに記録されているBMPファイルは処理済みとして除外
                    continue;
                }
            }
            
            // GIFファイルが既に処理済みかチェック（JSONに記録されている場合）
            if (file.toLowerCase().endsWith('.gif')) {
                if (compressed[file]) {
                    // JSONに記録されているGIFファイルは処理済みとして除外
                    continue;
                }
            }
            
            // 実際に処理するファイルとして追加
            files.push(file);
        }
        
        // スキップされたファイルのログを最初に一度だけ表示
        if (skippedFiles.length > 0) {
            skippedFiles.forEach(({ file, reason }) => {
                console.log(`⏭️ [画像変換] ${reason}: ${file}`);
            });
        }
        
        if (files.length === 0) {
            if (skippedFiles.length === 0) {
                console.log(`[画像変換] 処理対象のファイルがありません`);
            }
            return resolve();
        }
        
        console.log(`[画像変換] ${files.length}件の画像を処理中...`);
        
        for (const file of files) {
            const pngFile = file.replace(/\.(bmp|tiff|gif)$/i, '.png');
            const filePath = path.join(projectRoot, file);
            
            // 既にフィルタ済みなので、重複チェックは不要
            
            try {
                // 処理中のファイルとしてマーク
                processingFiles.add(file);
                processingFiles.add(pngFile);
                // BMPファイルもTIFFと同様にPNG変換後にWebP変換する
                
                // BMPファイルの場合はメタデータエラーでもPNG変換を試行
                let beforeMetadata;
                if (file.toLowerCase().endsWith('.bmp')) {
                    // BMPファイルはメタデータ取得をスキップして直接変換処理へ
                    beforeMetadata = { error: null };
                } else {
                    beforeMetadata = await getImageMetadata(filePath);
                    
                    if (beforeMetadata.error) {
                        console.error(`❌ [画像変換] 処理失敗: ${file} - ${beforeMetadata.error}`);
                        continue;
                    }
                }
                
                // GIFの場合はアニメーションかどうかチェック（静止画のみ処理）
                if (file.endsWith('.gif')) {
                    try {
                        const metadata = await sharp(filePath).metadata();
                        if (metadata.pages && metadata.pages > 1) {
                            // アニメーションGIFを処理済みとしてJSONに記録（元のファイル名で記録）
                            const stat = fs.statSync(filePath);
                            const fileHash = calculateFileHash(filePath, stat);
                            const mtimeMs = stat.mtimeMs || stat.mtime * 1000;
                            if (fileHash) {
                                compressed[file] = {
                                    fileHash,
                                    mtimeMs,
                                    manual: false,
                                    compressionLevel: 'low'
                                };
                                
                                // JSONを即座に保存
                                saveCompressedJson(compressed);
                                console.log(`⏭️ [画像変換] アニメーションGIFをスキップ: ${file} (${metadata.pages}フレーム)`);
                            }
                            
                            // 処理中のファイル追跡をクリア
                            processingFiles.delete(file);
                            processingFiles.delete(pngFile);
                            continue;
                        }
                    } catch (gifError) {
                        console.error(`❌ [画像変換] GIFファイルの読み込みエラー: ${file} - ${gifError.message}`);
                        
                        // GIFファイル読み込みエラー時もJSONに記録（元のファイル名で記録）
                        const stat = fs.statSync(filePath);
                        const fileHash = calculateFileHash(filePath, stat);
                        const mtimeMs = stat.mtimeMs || stat.mtime * 1000;
                        if (fileHash) {
                            compressed[file] = {
                                fileHash,
                                mtimeMs,
                                manual: false,
                                compressionLevel: 'low'
                            };
                            saveCompressedJson(compressed);
                        }
                        
                        // 処理中のファイル追跡をクリア
                        processingFiles.delete(file);
                        processingFiles.delete(pngFile);
                        continue;
                    }
                }
                
                // バックアップファイルを作成
                const backupPath = filePath + '.backup';
                fs.copyFileSync(filePath, backupPath);
                
                // 画像変換処理（BMP/TIFF/GIF → PNG）
                try {
                    const sharpInstance = sharp(filePath);
                    
                    // BMPファイルの場合はより詳細な設定でPNG変換
                    if (file.toLowerCase().endsWith('.bmp')) {
                        try {
                            await sharpInstance
                                .png({ 
                                    quality: 100,
                                    compressionLevel: 6,
                                    adaptiveFiltering: false,
                                    force: true 
                                })
                                .toFile(path.join(projectRoot, pngFile));
                        } catch (bmpSharpError) {
                            // SharpでBMP変換できない場合は、ImageMagick経由で再試行
                            console.log(`🔄 [画像変換] Sharpで失敗、ImageMagickでBMP変換を試行: ${file}`);
                            try {
                                const { execSync } = await import('child_process');
                                const pngPath = path.join(projectRoot, pngFile);
                                // ImageMagickのconvertコマンドを使用してBMP→PNG変換
                                execSync(`convert "${filePath}" "${pngPath}"`, { stdio: 'pipe' });
                                console.log(`✅ ImageMagickでBMP変換成功: ${file} → ${pngFile}`);
                            } catch (bmpMagickError) {
                                console.warn(`⚠️ [画像変換] ImageMagickでもBMP変換できませんでした: ${file} - ${bmpMagickError.message}`);
                                throw new Error(`BMP変換失敗: ${bmpMagickError.message}`);
                            }
                        }
                    } else {
                        await sharpInstance
                            .png()
                            .toFile(path.join(projectRoot, pngFile));
                    }
                } catch (sharpError) {
                    console.error(`❌ [画像変換] Sharp変換エラー: ${file} - ${sharpError.message}`);
                    
                    // BMPファイルの場合は、処理済みとしてJSONに記録（元のファイル名で記録）
                    if (file.toLowerCase().endsWith('.bmp')) {
                        const stat = fs.statSync(filePath);
                        const fileHash = calculateFileHash(filePath, stat);
                        const mtimeMs = stat.mtimeMs || stat.mtime * 1000;
                        if (fileHash) {
                            compressed[file] = {
                                fileHash,
                                mtimeMs,
                                manual: false,
                                compressionLevel: 'low'
                            };
                            console.log(`⚠️ [画像変換] BMPファイルをスキップ（変換不可）: ${file}`);
                            // JSONを即座に保存
                            saveCompressedJson(compressed);
                        }
                    }
                    
                    // バックアップから復元
                    const backupPath = filePath + '.backup';
                    if (fs.existsSync(backupPath)) {
                        fs.copyFileSync(backupPath, filePath);
                        fs.unlinkSync(backupPath);
                    }
                    failedFiles.add(file);
                    continue;
                }
                
                // 変換後の検証
                const pngPath = path.join(projectRoot, pngFile);
                
                // PNGファイルが存在するかチェック
                if (!fs.existsSync(pngPath)) {
                    console.error(`❌ [画像変換] PNGファイルが生成されませんでした: ${file}`);
                    // バックアップから復元
                    const backupPath = filePath + '.backup';
                    if (fs.existsSync(backupPath)) {
                        fs.copyFileSync(backupPath, filePath);
                        fs.unlinkSync(backupPath);
                    }
                    failedFiles.add(file);
                    continue;
                }
                
                // BMPファイルの場合は検証をスキップ（ImageMagick変換成功時）
                if (!file.toLowerCase().endsWith('.bmp')) {
                    const backupPath = filePath + '.backup';
                    const isValid = await logImageComparison(backupPath, pngPath, `BMP/TIFF/GIF変換`);
                    
                    if (!isValid) {
                        console.error(`❌ [画像変換] 処理失敗: ${file}`);
                        // バックアップから復元
                        fs.copyFileSync(backupPath, filePath);
                        // PNGファイルを削除
                        if (fs.existsSync(pngPath)) {
                            fs.unlinkSync(pngPath);
                        }
                        failedFiles.add(file);
                        // バックアップファイルを削除
                        if (fs.existsSync(backupPath)) {
                            fs.unlinkSync(backupPath);
                        }
                        continue;
                    }
                }
                
                // 変換後のPNGファイルを圧縮
                try {
                    const pngBackupPath = pngPath + '.backup';
                    fs.copyFileSync(pngPath, pngBackupPath);
                    
                    // Sharpを使用してPNG圧縮
                    const tempPngPath = pngPath + '.tmp';
                    await sharp(pngPath)
                        .png({ 
                            quality: 80,
                            compressionLevel: 6,
                            adaptiveFiltering: true,
                            force: true
                        })
                        .toFile(tempPngPath);
                    
                    // 一時ファイルを元のファイルに移動
                    fs.renameSync(tempPngPath, pngPath);
                    
                    // 圧縮後の検証
                    const compressIsValid = await logImageComparison(pngBackupPath, pngPath, `PNG圧縮`);
                    
                    if (!compressIsValid) {
                        console.error(`❌ [PNG圧縮] 処理失敗: ${pngFile}`);
                        // バックアップから復元
                        fs.copyFileSync(pngBackupPath, pngPath);
                    }
                    
                    // バックアップファイルを削除
                    if (fs.existsSync(pngBackupPath)) {
                        fs.unlinkSync(pngBackupPath);
                    }
                    
                } catch (compressErr) {
                    console.error(`❌ [画像変換] 圧縮失敗: ${pngFile}`, compressErr.message);
                }
                
                console.log(`✅ ${file} → ${pngFile}`);
                
                // 注意: 元ファイルはWebP変換が成功するまで削除しない
                // 元ファイルの削除はcleanOriginalImages関数で行う
                
            } catch (err) {
                console.error(`❌ [画像変換] 失敗: ${file}`, err.message);
                console.error('スタックトレース:', err.stack);
                failedFiles.add(file);
                // エラー時もバックアップファイルと一時ファイルを削除
                const backupPath = filePath + '.backup';
                const tempPath = filePath + '.tmp';
                if (fs.existsSync(backupPath)) {
                    fs.unlinkSync(backupPath);
                }
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                }
            } finally {
                // 処理中のファイル追跡をクリア
                processingFiles.delete(file);
                processingFiles.delete(pngFile);
            }
        }
        
        // JSONファイルを保存
        saveCompressedJson(compressed);
        resolve();
    });
};

/**
 * JPG/JPEG/PNG画像をWebP形式に変換（Sharp使用）
 * 対応形式: jpg, jpeg, png
 */
export const imagesWebp = () => {
    return new Promise(async (resolve) => {
        const compressed = loadCompressedJson();
        const projectRoot = process.cwd();
        const toRel = file => path.relative(projectRoot, file);
        const files = glob.sync(`wp-content/themes/${THEME_NAME}/assets/img/**/*.{jpg,jpeg,png,JPG,JPEG,PNG}`, { nocase: false }).map(toRel);
        
        if (files.length === 0) {
            return resolve();
        }
        
        // WebP変換対象をフィルタ
        const webpTargets = files.filter(file => {
            const webpFile = file.replace(/\.(jpg|jpeg|png)$/i, '.webp');
            // WebPファイルが既に存在するならスキップ
            if (fs.existsSync(path.join(projectRoot, webpFile))) {
                return false;
            }
            // JSONに記録されているがWebPファイルが存在しない場合は除外（処理済みとして扱う）
            if (compressed[webpFile] && !fs.existsSync(path.join(projectRoot, webpFile))) {
                return false;
            }
            // jsonに記録済みなら変換対象（圧縮済みのファイル）
            // ハイブリッド方式でファイルが変更されているかチェック
            if (compressed[webpFile] && compressed[webpFile].fileHash) {
                const filePath = path.join(projectRoot, file);
                if (!isFileChanged(filePath, compressed[webpFile])) {
                    // ファイルが変更されていない場合はスキップ
                    return false;
                }
                // ファイルが変更された場合は変換対象
                return true;
            }
            // jsonに記録されていない場合も変換対象（新規ファイル）
            return true;
        });
        
        if (webpTargets.length === 0) {
            return resolve();
        }
        
        console.log(`[WebP変換] ${webpTargets.length}件の画像を処理中...`);
        
        for (const file of webpTargets) {
            const webpFile = file.replace(/\.(jpg|jpeg|png)$/i, '.webp');
            const inputPath = path.join(projectRoot, file);
            const outputPath = path.join(projectRoot, webpFile);
            
            try {
                // 元の元画像（圧縮前）のサイズを取得
                // 1. バックアップファイルがある場合はそれを使用
                // 2. バックアップがない場合は、JSONに記録された元のサイズを復元
                const backupPath = inputPath + '.backup';
                let originalSize;
                
                if (fs.existsSync(backupPath)) {
                    // バックアップファイルから元のサイズを取得
                    originalSize = fs.statSync(backupPath).size;
                } else if (compressed[file] && compressed[file].originalSize) {
                    // JSONに元のサイズが記録されている場合はそれを使用
                    originalSize = compressed[file].originalSize;
                } else if (compressed[webpFile] && compressed[webpFile].originalSize) {
                    // WebPファイルのJSONに元のサイズが記録されている場合はそれを使用
                    originalSize = compressed[webpFile].originalSize;
                } else {
                    // どちらもない場合は現在のファイルサイズを使用（新規ファイルの場合）
                    originalSize = fs.statSync(inputPath).size;
                }
                
                const beforeMetadata = await getImageMetadata(inputPath);
                
                if (beforeMetadata.error) {
                    console.error(`❌ [WebP変換] 処理失敗: ${file} - ${beforeMetadata.error}`);
                    continue;
                }
                
                // ファイルの圧縮レベルを取得（デフォルトはlow）
                const compressionLevel = compressed[webpFile]?.compressionLevel || 'low';
                const settings = getCompressionSettings(compressionLevel);
                
                // WebPバックアップファイルを作成
                const webpBackupPath = inputPath + '.webp.backup';
                if (fs.existsSync(outputPath)) {
                    fs.copyFileSync(outputPath, webpBackupPath);
                }
                
                await sharp(inputPath)
                    .webp(settings.webp)
                    .toFile(outputPath);
                
                // 処理後の検証
                const isValid = await logImageComparison(inputPath, outputPath, `WebP変換 (${compressionLevel})`);
                
                if (!isValid) {
                    console.error(`❌ [WebP変換] 処理失敗: ${file}`);
                    // バックアップから復元（存在する場合）
                    if (fs.existsSync(webpBackupPath)) {
                        fs.copyFileSync(webpBackupPath, outputPath);
                    } else {
                        // WebPファイルを削除
                        if (fs.existsSync(outputPath)) {
                            fs.unlinkSync(outputPath);
                        }
                    }
                    failedFiles.add(file);
                    // WebPバックアップファイルを削除
                    if (fs.existsSync(webpBackupPath)) {
                        fs.unlinkSync(webpBackupPath);
                    }
                    continue;
                }
                
                const outputMetadata = await getImageMetadata(outputPath);
                const change = ((outputMetadata.fileSize - originalSize) / originalSize * 100);
                const changeText = change >= 0 ? `${change.toFixed(1)}% 増加` : `${Math.abs(change).toFixed(1)}% 削減`;
                
                // ファイルサイズを読みやすい形式に変換
                const formatSize = (bytes) => {
                    if (bytes >= 1024) {
                        return (bytes / 1024).toFixed(1) + 'KB';
                    }
                    return bytes + 'B';
                };
                
                console.log(`✅ ${file} → ${webpFile}: ${formatSize(originalSize)} → ${formatSize(outputMetadata.fileSize)} (${changeText}) [${compressionLevel}]`);
                
                // WebPファイルの情報をJSONに記録
                const webpHash = calculateFileHash(outputPath);
                if (webpHash) {
                    compressed[webpFile] = { 
                        fileHash: webpHash, 
                        manual: false, 
                        compressionLevel: compressionLevel,
                        originalSize: originalSize
                    };
                }
                
                // WebPバックアップファイルを削除
                if (fs.existsSync(webpBackupPath)) {
                    fs.unlinkSync(webpBackupPath);
                }
                
            } catch (err) {
                console.error(`❌ [WebP変換] 失敗: ${file}`, err.message);
                console.error('スタックトレース:', err.stack);
                failedFiles.add(file);
            }
        }
        
        // JSONファイルを保存（WebP変換処理の最後）
        saveCompressedJson(compressed);
        resolve();
    });
};

/**
 * WebPバージョンが存在する場合、元の画像ファイルを削除（Sharp使用）
 */
export const cleanOriginalImages = async () => {
    const projectRoot = process.cwd();
    const toRel = file => path.relative(projectRoot, file);
    const originalFiles = (await glob.glob(paths.images.src));
    const convertedPngFiles = (await glob.glob(`wp-content/themes/${THEME_NAME}/assets/img/**/*.png`));
    
    // compressedデータを最初に読み込み
    const compressed = loadCompressedJson();
    
    const toDelete = new Set();
    
    for (const file of originalFiles) {
        if (file.endsWith('.gif')) {
            try {
                const metadata = await sharp(file).metadata();
                if (metadata.pages && metadata.pages > 1) {
                    continue; // アニメーションGIFはスキップ
                }
            } catch (err) {
                // エラーの場合は通常処理を続行
            }
        }
        
        const webpPath = file.replace(/\.(jpg|jpeg|png|gif|bmp|tiff)$/i, '.webp');
        // WebPファイルが存在し、失敗ファイルリストにない場合に削除対象とする
        if (fs.existsSync(webpPath) && !failedFiles.has(file)) {
            // WebPファイルが存在する場合、元ファイルを削除対象とする
            toDelete.add(file);
        }
    }
    
    for (const pngFile of convertedPngFiles) {
        const webpPath = pngFile.replace(/\.png$/i, '.webp');
        // WebPファイルが存在し、失敗ファイルリストにない場合に削除対象とする
        if (fs.existsSync(webpPath) && !failedFiles.has(pngFile)) {
            // WebPファイルが存在する場合、PNGファイルを削除対象とする
            toDelete.add(pngFile);
        }
    }
    
    const toDeleteArray = Array.from(toDelete);
    
    // --- ここからjsonメンテナンス ---
    let changed = false;
    
    // ファイル削除時のjsonクリーンアップ
    for (const filePath of Object.keys(compressed)) {
        const fullPath = path.join(projectRoot, filePath);
        
        // スキップされたファイル（WebPファイルが作成されないファイル）かどうかを判定
        // ファイル拡張子がgifまたはbmpの場合はスキップされたファイル
        const isSkippedFile = filePath.toLowerCase().endsWith('.gif') || 
                                                    filePath.toLowerCase().endsWith('.bmp');
        
        // ファイルが存在しない場合（手動追加でない場合のみ）JSONから削除
        if (!fs.existsSync(fullPath) && !compressed[filePath].manual) {
            console.log(`[jsonクリーン] 削除されたファイルをjsonから除去: ${filePath}`);
            delete compressed[filePath];
            changed = true;
        }
    }
    
    if (toDeleteArray.length > 0) {
        console.log(`[画像クリーン] ${toDeleteArray.length}件の元画像を削除中...`);
        for (const file of toDeleteArray) {
            try {
                const normalizedPath = path.normalize(file);
                fs.unlinkSync(normalizedPath);
                const relPath = toRel(normalizedPath);
                
                // 手動追加でない場合のみjsonから削除
                if (compressed[relPath] && !compressed[relPath].manual) {
                    delete compressed[relPath];
                    changed = true;
                }
                // unix/Windowsパス両対応
                if (compressed[normalizedPath] && !compressed[normalizedPath].manual) {
                    delete compressed[normalizedPath];
                    changed = true;
                }
                if (compressed[file] && !compressed[file].manual) {
                    delete compressed[file];
                    changed = true;
                }
            } catch (err) {
                console.error(`❌ [画像クリーン] 削除失敗: ${file} - ${err.message}`);
            }
        }
    }
    if (changed) saveCompressedJson(compressed);
    // --- ここまでjsonメンテナンス ---
    
    // バックアップファイルと一時ファイルのクリーンアップ
    try {
        const backupFiles = (await glob.glob(`wp-content/themes/${THEME_NAME}/assets/img/**/*.backup`));
        const tempFiles = (await glob.glob(`wp-content/themes/${THEME_NAME}/assets/img/**/*.tmp`));
        
        [...backupFiles, ...tempFiles].forEach(file => {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            } catch (err) {
                // バックアップファイルの削除エラーは無視
            }
        });
    } catch (err) {
        // グローバルクリーンアップのエラーは無視
    }
    
    // 処理中のファイル追跡をクリア
    processingFiles.clear();
    
    if (failedFiles.size > 0) {
        const list = Array.from(failedFiles).join(', ');
        console.log(`\x1b[33m[注意] 画像処理失敗: ${failedFiles.size}件 (${list})\x1b[0m`);
    }
};

// 統合画像処理タスク（BMP/TIFF/GIFをPNGに変換後、JPG/PNGをWebPに変換）
export const processImages = async () => {
    // 画像処理が無効な場合はスキップ
    if (!PROJECT_SETTINGS.enableImageProcessing) {
        console.log('[画像処理] スキップ（設定で無効化されています）');
        return Promise.resolve();
    }
    
    try {
        // BMP/TIFF/GIF→PNG変換
        if (PROJECT_SETTINGS.imageProcessing.enableBmpTiffConversion) {
            await convertBmpTiff();
            await new Promise(res => setTimeout(res, 300));
        }
        
        // 画像最適化
        if (PROJECT_SETTINGS.imageProcessing.enableOptimize) {
            await imagesOptimize();
        }
        
        // WebP変換
        if (PROJECT_SETTINGS.imageProcessing.enableWebpConversion) {
            await imagesWebp();
        }
        
        // 元画像の削除
        if (PROJECT_SETTINGS.imageProcessing.enableCleanOriginal) {
            await cleanOriginalImages();
        }
        
        if (failedFiles.size > 0) {
            console.log(`\n⚠️ [処理結果] ${failedFiles.size}個のファイルで問題が発生しました`);
        }
        
    } catch (error) {
        console.error(`\n❌ [画像処理エラー]`, error.message);
        console.error('スタックトレース:', error.stack);
        throw error;
    } finally {
        failedFiles.clear();
        processingFiles.clear();
    }
};

// WebP最適化専用タスク
export const imagesWebpOnly = gulp.series(imagesWebp, cleanOriginalImages);

// 強制再圧縮タスク（recompress: true のみ対象）
export const imagesRecompress = () => {
    return imagesOptimize({ force: true, respectFlag: true });
};

// 強制再圧縮タスク（recompress: false 以外すべて対象）
export const imagesRecompressAll = () => {
    return imagesOptimize({ force: true, respectFlag: false });
};

// 強制再圧縮タスク（すべて対象、recompress: false も含む）
export const imagesRecompressForce = () => {
    return imagesOptimize({ force: true, forceAll: true });
};

// 特定ファイルのみ再圧縮タスク（recompress: true のみ対象）
export const imageFile = (filePath) => {
    return () => {
        return imagesOptimize({ force: true, file: filePath, respectFlag: true });
    };
};

// 特定ファイルのみ再圧縮（recompress: false 以外対象）
export const imageFileAll = (filePath) => {
    return () => {
        return imagesOptimize({ force: true, file: filePath, respectFlag: false });
    };
};

// 特定ファイルのみ再圧縮（すべて対象、recompress: false も含む）
export const imageFileForce = (filePath) => {
    return () => {
        return imagesOptimize({ force: true, file: filePath, forceAll: true });
    };
};


// watch処理用の画像処理関数（無限ループ防止）
const processImageFile = (filePath) => {
    return new Promise(async (resolve) => {
        const projectRoot = process.cwd();
        const relativePath = path.relative(projectRoot, filePath);
        
        // 処理中のファイルはスキップ
        if (processingFiles.has(relativePath)) {
            resolve();
            return;
        }
        
        // 拡張子によって処理を分岐
        const ext = path.extname(filePath).toLowerCase();
        
        try {
            if (['.bmp', '.tiff', '.gif'].includes(ext)) {
                // BMP/TIFF/GIFファイルの場合、convertBmpTiffを実行
                await convertBmpTiff();
                // 少し待ってからWebP変換とクリーンアップを実行
                setTimeout(async () => {
                    await imagesWebp();
                    await cleanOriginalImages();
                    resolve();
                }, 500);
            } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                // 既存のJPG/PNGファイルの場合
                await imagesWebp();
                await cleanOriginalImages();
                resolve();
            } else {
                resolve();
            }
        } catch (error) {
            console.error(`[watch処理エラー] ${relativePath}:`, error.message);
            resolve();
        }
    });
};

// --- WATCH タスク ---
/**
 * ファイル変更を監視し、適切なタスクを実行
 */
const watchFiles = () => {
    console.log('[Watch] ファイル監視を開始します...');
    
    // SCSS監視
    if (PROJECT_SETTINGS.enableScss) {
        gulp.watch(paths.scss.watch, scss);
        console.log('[Watch] SCSS監視: 有効');
    } else {
        console.log('[Watch] SCSS監視: 無効');
    }
    
    // JavaScript監視
    if (PROJECT_SETTINGS.enableJs) {
        gulp.watch(paths.js.watch, js);
        console.log('[Watch] JavaScript監視: 有効');
    } else {
        console.log('[Watch] JavaScript監視: 無効');
    }
    
    // HTML/PHPファイルの監視
    if (PROJECT_SETTINGS.enableHtmlFormat) {
        gulp.watch(paths.html.watch, formatHtml);
        console.log('[Watch] HTML/PHP監視: 有効');
    } else {
        console.log('[Watch] HTML/PHP監視: 無効');
    }
    
    // 画像ファイルの監視（無限ループ防止）
    if (PROJECT_SETTINGS.enableImageProcessing) {
        gulp.watch(`wp-content/themes/${THEME_NAME}/assets/img/**/*.{jpg,jpeg,png,gif,bmp,tiff,JPG,JPEG,PNG,GIF,BMP,TIFF}`, (cb) => {
            // watchイベントを非同期で処理し、完了後にcallbackを呼ぶ
            setTimeout(() => {
                const promises = [];
                
                // BMP/TIFF/GIF→PNG変換
                if (PROJECT_SETTINGS.imageProcessing.enableBmpTiffConversion) {
                    promises.push(convertBmpTiff());
                }
                
                Promise.all(promises)
                    .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
                    .then(() => {
                        const webpPromises = [];
                        
                        // WebP変換
                        if (PROJECT_SETTINGS.imageProcessing.enableWebpConversion) {
                            webpPromises.push(imagesWebp());
                        }
                        
                        return Promise.all(webpPromises);
                    })
                    .then(() => {
                        // 元画像削除
                        if (PROJECT_SETTINGS.imageProcessing.enableCleanOriginal) {
                            return cleanOriginalImages();
                        }
                    })
                    .then(() => {
                        // 処理中のファイル追跡を全クリア
                        processingFiles.clear();
                        cb();
                    })
                    .catch((error) => {
                        console.error('[watch処理エラー]:', error.message);
                        processingFiles.clear();
                        cb();
                    });
            }, 100);
        });
        console.log('[Watch] 画像監視: 有効');
    } else {
        console.log('[Watch] 画像監視: 無効');
    }
};

// --- メインタスク ---
/**
 * 本番用ビルドタスク
 * クリーンアップ後、CSS、JS、HTML/PHPフォーマット、画像変換をビルド
 */
export const build = gulp.series(
    clean,
    gulp.parallel(scss, js, formatHtml),
    processImages
);

/**
 * 開発タスク（デフォルト）
 * すべてをビルドし、変更の監視を開始
 */
export const dev = gulp.series(
    gulp.parallel(scss, js, formatHtml),
    processImages,
    watchFiles
);

export default dev;
