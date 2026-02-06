const fs = require("fs/promises");
const path = require("path");

const SEP = "\n\n--\n\n";

const IGNORE_DIRS = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    "out",
    ".next",
    ".cache",
    "coverage",
]);

const IGNORE_EXTS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    ".pdf",
    ".zip", ".rar", ".7z", ".tar", ".gz",
    ".mp3", ".wav", ".mp4", ".mov",
    ".woff", ".woff2", ".ttf", ".otf",
    ".exe", ".dll", ".dmg", ".app",
]);

const MAX_FILE_BYTES = 500_000;
const BINARY_SNIFF_BYTES = 8000;

async function bundleFromFolder(root, options) {
    const files = await listFilesRecursive(root);
    files.sort((a, b) => a.localeCompare(b));
    return await bundleFilesInternal(files, root, options);
}

async function bundleFromFiles(filePaths, options) {
    // If user picks files, use common parent as “root” for relative paths
    const root = commonParent(filePaths);
    const sorted = [...filePaths].sort((a, b) => a.localeCompare(b));
    return await bundleFilesInternal(sorted, root, options);
}

async function bundleFilesInternal(absPaths, root, options) {
    const parts = [];
    let included = 0;
    let skipped = 0;
    const includedFiles = [];
    const skippedFiles = [];

    const formatLabel = (absPath) => {
        return options?.useBasenameOnly
            ? path.basename(absPath)
            : path.relative(root, absPath).replace(/\\/g, "/");
    };

    for (const absPath of absPaths) {
        const label = formatLabel(absPath);
        const ext = path.extname(absPath).toLowerCase();
        if (IGNORE_EXTS.has(ext)) {
            skipped++;
            skippedFiles.push({ path: label, reason: "ignored extension" });
            continue;
        }

        let stat;
        try {
            stat = await fs.stat(absPath);
        } catch {
            skipped++;
            skippedFiles.push({ path: label, reason: "read failed" });
            continue;
        }
        if (!stat.isFile()) {
            skipped++;
            skippedFiles.push({ path: label, reason: "not a file" });
            continue;
        }
        if (stat.size > MAX_FILE_BYTES) {
            skipped++;
            skippedFiles.push({ path: label, reason: "too large" });
            continue;
        }

        if (await sniffBinary(absPath)) {
            skipped++;
            skippedFiles.push({ path: label, reason: "binary" });
            continue;
        }

        let content;
        try {
            content = await fs.readFile(absPath, "utf8");
        } catch {
            skipped++;
            skippedFiles.push({ path: label, reason: "read failed" });
            continue;
        }

        content = content.replace(/\r\n/g, "\n");

        parts.push(`${label}:\n${content}`);
        included++;
        includedFiles.push(label);
    }

    return {
        output: parts.join(SEP),
        stats: { included, skipped, total: absPaths.length },
        files: {
            included: includedFiles,
            skipped: skippedFiles,
        },
    };
}

async function listFilesRecursive(root) {
    const out = [];

    async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (IGNORE_DIRS.has(entry.name)) continue;
                await walk(abs);
            } else if (entry.isFile()) {
                out.push(abs);
            }
        }
    }

    await walk(root);
    return out;
}

async function sniffBinary(filePath) {
    try {
        const handle = await fs.open(filePath, "r");
        try {
            const buf = Buffer.alloc(BINARY_SNIFF_BYTES);
            const { bytesRead } = await handle.read(buf, 0, BINARY_SNIFF_BYTES, 0);
            const slice = buf.subarray(0, bytesRead);

            if (slice.includes(0)) return true;

            let weird = 0;
            for (const b of slice) {
                if (b < 9) weird++;
                else if (b > 13 && b < 32) weird++;
            }
            return bytesRead > 0 && weird / bytesRead > 0.2;
        } finally {
            await handle.close();
        }
    } catch {
        return true;
    }
}

function commonParent(pathsArr) {
    if (!pathsArr || pathsArr.length === 0) return process.cwd();
    const split = pathsArr.map(p => path.resolve(p).split(path.sep));
    let i = 0;
    while (true) {
        const segment = split[0][i];
        if (!segment) break;
        if (split.some(parts => parts[i] !== segment)) break;
        i++;
    }
    return split[0].slice(0, i).join(path.sep) || process.cwd();
}

module.exports = { bundleFromFolder, bundleFromFiles };