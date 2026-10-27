#!/usr/bin/env node

/**
 * Markuplintラッパースクリプト
 * PHPファイルのinclude文を前処理してからMarkuplintを実行する
 * includeファイルの内容を展開し、エラーメッセージのファイルパスを適切に置き換える
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * include文からファイルパスを抽出する
 */
function extractIncludePath(includeStatement, currentFileDir) {
    // <?php include($_SERVER['DOCUMENT_ROOT']."/path/to/file.php"); ?> の形式を解析
    // シングルクォートとダブルクォートの両方に対応
    const match = includeStatement.match(/include\s*\(\s*\$_[A-Z_]+\s*\[\s*['"]([^'"]+)['"]\s*\]\s*\.\s*["']([^"']+)["']\s*\)/);
    if (match) {
        const includePath = match[2];
        // DOCUMENT_ROOTからの相対パスを解決
        const projectRoot = process.cwd();
        const resolvedPath = path.resolve(projectRoot, includePath.replace(/^\//, ''));
        return resolvedPath;
    }
    
    // 相対パスの場合: include("path/to/file.php") または include('path/to/file.php')
    const relativeMatch = includeStatement.match(/include\s*\(\s*["']([^"']+)["']\s*\)/);
    if (relativeMatch) {
        const relativePath = relativeMatch[1];
        return path.resolve(currentFileDir, relativePath);
    }
    
    return null;
}

/**
 * PHPファイルを前処理し、include文を展開する
 */
function preprocessPhpFile(filePath, processedIncludes = new Set()) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileDir = path.dirname(filePath);
        let processed = content;
        const includeMap = new Map(); // 展開された行番号 -> 元のincludeファイルパス
        
        // include文を検索して展開
        const includeRegex = /<\?php\s+include\s*\([^)]+\)\s*;\s*\?>/g;
        let match;
        let offset = 0;
        
        while ((match = includeRegex.exec(content)) !== null) {
            const includeStatement = match[0];
            const includePath = extractIncludePath(includeStatement, fileDir);
            
            if (includePath && fs.existsSync(includePath) && !processedIncludes.has(includePath)) {
                try {
                    // includeファイルの内容を読み込む（再帰的に処理）
                    processedIncludes.add(includePath);
                    const includeResult = preprocessPhpFile(includePath, processedIncludes);
                    const includeContent = includeResult.content;
                    const includeIncludeMap = includeResult.includeMap;
                    processedIncludes.delete(includePath);
                    
                    // include文を展開された内容に置き換え
                    const beforeInclude = processed.substring(0, match.index + offset);
                    const afterInclude = processed.substring(match.index + offset + match[0].length);
                    
                    // 展開された内容の行番号をマッピング
                    const linesBefore = beforeInclude.split('\n').length;
                    const includeLines = includeContent.split('\n').length;
                    
                    // 展開された行の範囲を記録（includeファイル内の行番号をマッピング）
                    for (let i = 0; i < includeLines; i++) {
                        const lineNum = linesBefore + i;
                        // includeファイル内の元の行番号を計算
                        const originalLineInInclude = i + 1;
                        includeMap.set(lineNum, {
                            file: includePath,
                            originalLine: originalLineInInclude
                        });
                    }
                    
                    processed = beforeInclude + includeContent + afterInclude;
                    offset += includeContent.length - match[0].length;
                } catch (error) {
                    // includeファイルが読み込めない場合は警告を出してスキップ
                    console.warn(`Warning: Could not include ${includePath}: ${error.message}`);
                }
            } else {
                // includeファイルが見つからない場合は空文字列に置き換え
                processed = processed.replace(includeStatement, '');
                offset -= includeStatement.length;
            }
        }
        
        return { content: processed, includeMap };
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
        throw error;
    }
}

function createTempFile(originalPath, content) {
    const tempDir = tmpdir();
    const fileName = path.basename(originalPath);
    const tempPath = path.join(tempDir, `markuplint-${Date.now()}-${fileName}`);
    fs.writeFileSync(tempPath, content, 'utf8');
    return tempPath;
}

/**
 * エラーメッセージのファイルパスを元のファイルパスに置き換える
 * includeファイル内のエラーの場合は、元のincludeファイルのパスを表示する
 */
function replaceTempPathsInOutput(output, tempToOriginalMap, includeLineMaps) {
    let result = output;
    
    // 一時ファイルパスを元のファイルパスに置き換え
    for (const [tempPath, originalPath] of Object.entries(tempToOriginalMap)) {
        const tempPathEscaped = tempPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // エラーメッセージのパターンを検出: /path/to/file:line:column
        const errorPattern = new RegExp(`(${tempPathEscaped}):(\\d+):(\\d+)`, 'g');
        
        result = result.replace(errorPattern, (match, filePath, lineNum, columnNum) => {
            const line = parseInt(lineNum, 10);
            const column = parseInt(columnNum, 10);
            
            // includeファイルのマッピングを確認
            const includeMap = includeLineMaps.get(tempPath);
            if (includeMap && includeMap.has(line)) {
                // includeファイル内のエラーの場合
                const mapping = includeMap.get(line);
                if (typeof mapping === 'object' && mapping.file) {
                    return `${mapping.file}:${mapping.originalLine}:${column}`;
                } else if (typeof mapping === 'string') {
                    // 後方互換性のため
                    return `${mapping}:${line}:${column}`;
                }
            }
            
            // 元のファイルのエラーの場合
            return `${originalPath}:${line}:${column}`;
        });
        
        // 絶対パスの置き換え（エラーパターン以外）
        result = result.replace(new RegExp(tempPathEscaped, 'g'), originalPath);
    }
    
    return result;
}

async function runMarkuplintWithPreprocessing(filePaths) {
    const tempFiles = [];
    const processedPaths = [];
    const tempToOriginalMap = {}; // 一時ファイルパス -> 元のファイルパスのマッピング
    const includeLineMaps = new Map(); // 一時ファイルパス -> include行番号マッピング
    
    try {
        // PHPファイルを前処理
        for (const filePath of filePaths) {
            if (filePath.endsWith('.php')) {
                const { content, includeMap } = preprocessPhpFile(filePath);
                const tempPath = createTempFile(filePath, content);
                tempFiles.push(tempPath);
                processedPaths.push(tempPath);
                tempToOriginalMap[tempPath] = path.resolve(filePath);
                includeLineMaps.set(tempPath, includeMap);
            } else {
                processedPaths.push(filePath);
            }
        }
        
        // Markuplintを実行（設定ファイルを明示的に指定）
        const projectRoot = process.cwd();
        const configPath = path.join(projectRoot, '.markuplintrc.json');
        const markuplintArgs = ['markuplint'];
        
        // 設定ファイルが存在する場合は明示的に指定
        if (fs.existsSync(configPath)) {
            markuplintArgs.push('--config', configPath);
        }
        
        markuplintArgs.push(...processedPaths);
        
        // 出力をキャプチャして処理する（色を保持するためFORCE_COLORを設定）
        const markuplintProcess = spawn('npx', markuplintArgs, {
            stdio: ['inherit', 'pipe', 'pipe'],
            shell: true,
            cwd: projectRoot,
            env: {
                ...process.env,
                FORCE_COLOR: '1',
                NO_COLOR: undefined
            }
        });
        
        let stdout = '';
        let stderr = '';
        let stdoutBuffer = Buffer.alloc(0);
        let stderrBuffer = Buffer.alloc(0);
        
        markuplintProcess.stdout.on('data', (data) => {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            stdoutBuffer = Buffer.concat([stdoutBuffer, buffer]);
            stdout += data.toString();
        });
        
        markuplintProcess.stderr.on('data', (data) => {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            stderrBuffer = Buffer.concat([stderrBuffer, buffer]);
            stderr += data.toString();
        });
        
        const exitCode = await new Promise((resolve) => {
            markuplintProcess.on('close', (code) => {
                resolve(code);
            });
        });
        
        // 一時ファイルを削除
        tempFiles.forEach(tempFile => {
            try {
                fs.unlinkSync(tempFile);
            } catch (error) {
                // 無視
            }
        });
        
        // 出力を処理して表示（色を保持するためBufferを直接書き込む）
        if (stdoutBuffer.length > 0) {
            const processedOutput = replaceTempPathsInOutput(stdout, tempToOriginalMap, includeLineMaps);
            // 色を保持するため、元のBufferから色情報を抽出して適用
            process.stdout.write(processedOutput);
        }
        if (stderrBuffer.length > 0) {
            const processedError = replaceTempPathsInOutput(stderr, tempToOriginalMap, includeLineMaps);
            process.stderr.write(processedError);
        }
        
        // 終了コードを返す
        if (exitCode !== 0) {
            process.exit(exitCode);
        }
    } catch (error) {
        // 一時ファイルを削除
        tempFiles.forEach(tempFile => {
            try {
                fs.unlinkSync(tempFile);
            } catch (error) {
                // 無視
            }
        });
        console.error('Error:', error);
        process.exit(1);
    }
}

// コマンドライン引数を取得
const args = process.argv.slice(2);

if (args.length === 0) {
    // ファイルパスが指定されていない場合は、globパターンを使用
    (async () => {
        try {
            const files = await glob('**/*.php', {
                ignore: ['node_modules/**', '**/include/**']
            });
            
            if (files.length === 0) {
                console.log('No PHP files found');
                process.exit(0);
            }
            
            await runMarkuplintWithPreprocessing(files);
        } catch (error) {
            console.error('Error:', error);
            process.exit(1);
        }
    })();
} else {
    // ファイルパスが指定されている場合
    // globパターンの場合は展開する
    (async () => {
        try {
            const allFiles = [];
            const patterns = args;
            
            for (const pattern of patterns) {
                const files = await glob(pattern, {
                    ignore: ['node_modules/**', '**/include/**']
                });
                allFiles.push(...files);
            }
            
            if (allFiles.length === 0) {
                console.log('No files found');
                process.exit(0);
            }
            
            await runMarkuplintWithPreprocessing(allFiles);
        } catch (error) {
            console.error('Error:', error);
            process.exit(1);
        }
    })();
}
