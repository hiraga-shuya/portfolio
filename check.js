// checker.js
import fs from "fs";
import path from "path";
import chalk from "chalk";
import fetch from "node-fetch";
import { glob } from "glob";
import { execSync } from "child_process";


const ROOT = process.cwd();

// ------------------------------
// CONFIG
// ------------------------------
const IGNORE_FOLDERS = ["node_modules", ".git", "vendor", "dist", "build"];

const REQUIRED_TAGS = [
    `<meta property="og:title"`,
    `<meta property="og:type"`,
    `<meta property="og:description"`,
    `<meta property="og:url"`,
    `<meta property="og:image"`,
    `<meta property="og:site_name"`,
    `<meta property="og:locale"`,
    `<meta name="description"`,
    `<title>`,
];

// STRICT BEM RULE
const BEM_REGEX = /^[A-Za-z0-9]+(?:__(?:[A-Za-z0-9]+)){0,2}(?:--[A-Za-z0-9]+)?$/;

// Allowed directory structure patterns (FILE placement rules)
const ALLOWED_STRUCTURE_PATTERNS = [
    /^index\.php$/,
    /^test\/index\.php$/,
    /^test\/test2\/(test2\.php|index\.php)$/,
    /^src\/js\/.+$/,
    /^src\/scss\/.+$/,
    /^wp-content\/themes\/portfolio\/.+$/,
];

// ------------------------------
// EXPECTED PROJECT STRUCTURE (Missing-check only)
// ------------------------------
const EXPECTED_STRUCTURE = {
    "index.php": "file",

    "test": {
        "index.php": "file",
        "test2": {
            "test.php": "file",
            "index.php": "file",
        },
    },

    "src": {
        "js": {},
        "scss": {},
    },

    "wp-content": {
        "themes": {
            "portfolio": {
                "assets": {
                    "css": {},
                    "img": {},
                    "include": {},
                },
            },
        },
    },
};

// ------------------------------
// VALIDATE DIRECTORY STRUCTURE (only missing check)
// ------------------------------
function validateStructure(expected, currentPath = ROOT, missing = []) {
    if (!fs.existsSync(currentPath)) return missing;

    for (const key of Object.keys(expected)) {
        const expectedFullPath = path.join(currentPath, key);

        if (!fs.existsSync(expectedFullPath)) {
            missing.push(expectedFullPath.replace(ROOT + "/", ""));
            continue;
        }

        if (typeof expected[key] === "object") {
            validateStructure(expected[key], expectedFullPath, missing);
        }
    }

    return missing;
}

// ------------------------------
// STRUCTURE: FILE PLACEMENT CHECK
// ------------------------------
function isValidStructure(filePath) {
    const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
    return ALLOWED_STRUCTURE_PATTERNS.some((pattern) => pattern.test(rel));
}

// ------------------------------
// CRAWL FILES
// ------------------------------
function crawlFiles(dir, results = []) {
  const list = fs.readdirSync(dir);

  for (const item of list) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (IGNORE_FOLDERS.includes(item.toLowerCase())) continue;
            crawlFiles(fullPath, results);
            continue;
        }

        if (item.endsWith(".html") || item.endsWith(".php")) {
            results.push(path.resolve(fullPath));
        }
    }

    return results;
}

// ------------------------------
// BEM CHECKER
// ------------------------------
function extractBEMErrors(content) {
    const lines = content.split("\n");
    const errors = [];
    const classRegex = /class=["']([^"']+)["']/g;

    lines.forEach((line, index) => {
        let m;
        while ((m = classRegex.exec(line))) {
            const classes = m[1].trim().split(/\s+/);

            classes.forEach((cls) => {
                if (!BEM_REGEX.test(cls)) {
                    errors.push({
                        line: index + 1,
                        message: `class name ${chalk.yellow('"' + cls + '"')} in line ${chalk.cyan(
                            index + 1
                        )} does not follow BEM`,
                    });
                }
            });
        }
    });

    return errors;
}

// ------------------------------
// LINK CHECKERS
// ------------------------------
function extractLinks(content) {
    const regex = /<a[^>]*href=["']([^"']+)["']/gi;
    const arr = [];
    let m;
    while ((m = regex.exec(content))) arr.push(m[1]);
    return arr;
}

function skipLink(url) {
    return (
        !url ||
        url.startsWith("javascript:") ||
        url.startsWith("mailto:") ||
        url.startsWith("tel:")
    );
}

async function checkHttp(url) {
    try {
        const res = await fetch(url, { method: "HEAD" });
        return { url, status: res.status, dead: !res.ok };
    } catch {
        return { url, status: 0, dead: true };
    }
}

function checkLocalFile(baseFile, href) {
    let fp;

    if (href.startsWith("/")) {
        fp = path.join(ROOT, href);
    } else {
        fp = path.resolve(path.dirname(baseFile), href);
    }

    const exists = fs.existsSync(fp);
    return { url: href, status: exists ? 200 : 404, dead: !exists };
}

// ------------------------------
// DUMMY DATA CHECK
// ------------------------------
function detectDummyData(content) {
    const lines = content.split("\n");
    const errors = [];

    const dummyPatterns = [
        /\bxxx\b/i,
        /\bdummy\b/i,
        /サンプル/,
        /テキスト/,
        /\btext\b/i,
        /https:\/\/placehold\.jp/i,
        /noimage/i,
        /placeholder/i,
        /sample/i,
        /\btemp\b/i,
    ];

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        if (
            /<a[^>]+href=["']#["']/.test(trimmed) ||
            /<a[^>]+href=["']\s*["']/.test(trimmed)
            ) {
            errors.push({
                line: index + 1,
                message: `dummy data detected at line ${chalk.cyan(
                    index + 1
                )}: ${chalk.yellow(trimmed)}`,
            });
        }

        for (const pattern of dummyPatterns) {
            if (pattern.test(line)) {
                if (/text(-|_)?[a-z]/i.test(line)) continue;
                if (/context/i.test(line)) continue;

                errors.push({
                    line: index + 1,
                    message: `dummy data detected at line ${chalk.cyan(
                        index + 1
                    )}: ${chalk.yellow(trimmed)}`,
                });
            }
        }
    });

    return errors;
}

// ------------------------------
// EMPTY META/TITLE CHECK
// ------------------------------
function detectEmptyMetaContent(content) {
    const lines = content.split("\n");
    const errors = [];

    lines.forEach((line, index) => {
        const cleaned = line.trim();

        const metaMatch = cleaned.match(
            /<meta[^>]+(name|property)=["'][^"']+["'][^>]*content=["'](.*?)["']/i
        );
        if (metaMatch && metaMatch[2].trim() === "") {
            errors.push({
                line: index + 1,
                message: `Empty meta content at line ${index + 1}: ${chalk.yellow(cleaned)}`,
            });
        }

        const titleMatch = cleaned.match(/<title>(.*?)<\/title>/i);
            if (titleMatch && titleMatch[1].trim() === "") {
                errors.push({
                    line: index + 1,
                    message: `Empty <title> at line ${index + 1}`,
                });
            }

            const canonicalMatch = cleaned.match(
                /<link[^>]*rel=["']canonical["'][^>]*href=["'](.*?)["']/i
            );
            if (canonicalMatch && canonicalMatch[1].trim() === "") {
                errors.push({
                    line: index + 1,
                    message: `Canonical tag href EMPTY at line ${index + 1}`,
                });
            }

            const faviconMatch = cleaned.match(
            /<link[^>]*rel=["']icon["'][^>]*href=["'](.*?)["']/i
        );
        if (faviconMatch && faviconMatch[1].trim() === "") {
            errors.push({
                line: index + 1,
                message: `Favicon href EMPTY at line ${index + 1}`,
            });
        }

        const faviconMissingHref = cleaned.match(
            /<link[^>]*rel=["']icon["'](?![^>]*href=)/i
        );
        if (faviconMissingHref) {
            errors.push({
                line: index + 1,
                message: `Favicon tag MISSING href attribute at line ${index + 1}`,
            });
        }
    });

    return errors;
}

// ------------------------------
// FILE CHECKER
// ------------------------------
async function checkFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const isInclude = filePath.includes("/include/");

    const missingMeta = isInclude
        ? []
        : REQUIRED_TAGS.filter((tag) => !content.includes(tag));

    const canonicalMissing = isInclude
        ? false
        : !/<link[^>]*rel=["']canonical["']/.test(content);

    const canonicalHrefMissing =
        isInclude
        ? false
        : /rel=["']canonical["']/.test(content) &&
            !/href=["'][^"']+["']/.test(content);

    const faviconMissing = isInclude
        ? false
        : !/<link[^>]*rel=["']icon["'][^>]*href=["'][^"']+["']/.test(content);

    const bemErrors = extractBEMErrors(content);
    const dummyErrors = detectDummyData(content);
    const emptyMetaErrors = detectEmptyMetaContent(content);

    const links = extractLinks(content).filter((u) => !skipLink(u));
    const deadLinks = [];

    for (const href of links) {
        if (/^https?:\/\//i.test(href)) {
            const r = await checkHttp(href);
            if (r.dead) deadLinks.push(r);
        } else {
            const r = checkLocalFile(filePath, href);
            if (r.dead) deadLinks.push(r);
        }
    }

    return {
        file: filePath,
        isInclude,
        invalidStructure: !isValidStructure(filePath),
        missingMeta,
        canonicalMissing,
        canonicalHrefMissing,
        faviconMissing,
        bemErrors,
        dummyErrors,
        emptyMetaErrors,
        deadLinks,
    };
}



function runHtmlLint() {
    try {
        console.log("\n----------------------------------------");
        console.log(" Running HTML Linter (npm run lint:html)");
        console.log("----------------------------------------\n");

        execSync("npm run lint:html", { stdio: "inherit" });
    } catch (err) {
        console.error("\nHTML Lint failed.\n");
    }
}

function runFileLint(file) {
    try {
        console.log("\n----------------------------------------");
        console.log(` Running File Linter: npm run lint:file -- "${file}"`);
        console.log("----------------------------------------\n");

        execSync(`npm run lint:file -- "${file}"`, { stdio: "inherit" });
    } catch (err) {
        console.error(`\nLint failed for file: ${file}\n`);
    }
}


// ------------------------------
// MAIN
// ------------------------------
(async () => {


    const userArgs = process.argv.slice(2);

    if (userArgs.length === 0) {
        // 🌟 No file passed → run full HTML lint
        runHtmlLint();
    } else {
        // 🌟 File(s) passed → run per-file lint for each file input
        userArgs.forEach((arg) => {
            runFileLint(arg);
        });
    }

    console.log(chalk.white.bold("\nPROJECT STRUCTURE CHECK (Missing only)\n"));

    const missingList = validateStructure(EXPECTED_STRUCTURE);

    if (missingList.length === 0)
        console.log(chalk.green(" ✓ No missing folders/files"));
    else {
        console.log(chalk.red(" ✗ Missing required folders/files:"));
        missingList.forEach((p) => console.log(chalk.yellow(`   - ${p}`)));
    }

    console.log("\n" + "=".repeat(60) + "\n");

    // ------------------------

    let files = [];

    if (process.argv.slice(2).length > 0) {
        const userArgs = process.argv.slice(2);
        const allMatches = [];

        for (const arg of userArgs) {
        const matches = await glob(arg, {
            cwd: ROOT,
            absolute: true,
            nodir: true,
            ignore: IGNORE_FOLDERS.map((folder) => `**/${folder}/**`),
        });

        if (matches.length > 0) {
            allMatches.push(...matches);
        } else {
            const absolute = path.resolve(ROOT, arg);
            if (fs.existsSync(absolute)) {
                allMatches.push(absolute);
            }
        }
        }

        files = Array.from(
            new Set(
                allMatches.filter(
                    (file) => file.endsWith(".html") || file.endsWith(".php")
                )
            )
        );

        if (files.length === 0) {
            console.log(chalk.red(`\n✗ No files found matching: ${userArgs.join(" ")}\n`));
            process.exit(1);
        }

        console.log(
            chalk.magenta(
                `\nChecking ${files.length} file(s) matching: ${userArgs.join(" ")}\n`
            )
        );
    } else {
        let rawFiles = crawlFiles(ROOT);
        files = Array.from(new Set(rawFiles));
        console.log(chalk.cyan(`\nScanning ${files.length} files...\n`));
    }

    // FILE-BY-FILE CHECK
    for (const file of files) {
        const r = await checkFile(file);

        console.log(chalk.white.bold("File: ") + chalk.blue(r.file));
        console.log("");

        if (r.invalidStructure)
            console.log(chalk.red("  ✗ File is NOT placed correctly"));
        else console.log(chalk.green("  ✓ File placement OK"));
            console.log("");

        if (!r.isInclude) {
            if (r.missingMeta.length === 0)
                console.log(chalk.green("  ✓ All required meta tags found"));
            else {
                console.log(chalk.red("  ✗ Missing meta tags:"));
                r.missingMeta.forEach((tag) => console.log(chalk.yellow(`    - ${tag}`)));
            }
            console.log("");

            if (r.emptyMetaErrors.length === 0)
                console.log(chalk.green("  ✓ No empty meta/tag content"));
            else {
                console.log(chalk.red("  ✗ Empty meta/tag content detected:"));
                r.emptyMetaErrors.forEach((err) =>
                    console.log(chalk.yellow(`    - ${err.message}`))
                );
            }
            console.log("");

            if (r.canonicalMissing)
                console.log(chalk.red("  ✗ Missing <link rel=\"canonical\">"));
            else if (r.canonicalHrefMissing)
                console.log(chalk.red("  ✗ Canonical tag missing href"));
            else console.log(chalk.green("  ✓ Canonical tag OK"));

            console.log("");
        }

        if (r.bemErrors.length === 0)
            console.log(chalk.green("  ✓ All class names follow BEM"));
        else {
            console.log(chalk.red("  ✗ Invalid BEM class names:"));
            r.bemErrors.forEach((err) =>
                console.log(chalk.yellow(`    - ${err.message}`))
            );
        }
        console.log("");

        if (r.dummyErrors.length === 0)
            console.log(chalk.green("  ✓ No dummy data found"));
        else {
            console.log(chalk.red("  ✗ Dummy data detected:"));
            r.dummyErrors.forEach((err) =>
                console.log(chalk.yellow(`    - ${err.message}`))
            );
        }
        console.log("");

        if (r.deadLinks.length === 0)
            console.log(chalk.green("  ✓ No dead links"));
        else {
            console.log(chalk.red("  ✗ Dead links:"));
            r.deadLinks.forEach((link) =>
                console.log(chalk.yellow(`    - ${link.url} (status: ${link.status})`))
            );
        }

        console.log("\n" + "-".repeat(60) + "\n");
    }
})();
