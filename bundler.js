const fs = require("fs/promises");
const path = require("path");
const ignore = require("ignore");

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
    const excludedPathSet = buildExcludedPathSet(options?.excludedPaths);
    const { files, skipped } = await listFilesRecursive(root, {
        respectGitignore: true,
        excludedPathSet,
        collectSkipped: true,
    });
    files.sort((a, b) => a.localeCompare(b));
    return await bundleFilesInternal(files, root, options, skipped);
}

async function bundleFromFiles(filePaths, options) {
    // If user picks files, use common parent as “root” for relative paths
    const root = commonParent(filePaths);
    const excludedPathSet = buildExcludedPathSet(options?.excludedPaths);
    const skipped = [];
    const filtered = [];

    for (const filePath of filePaths) {
        if (isPathExcluded(filePath, excludedPathSet)) {
            skipped.push({ absPath: filePath, reason: "removed from selection" });
            continue;
        }
        filtered.push(filePath);
    }

    const sorted = [...filtered].sort((a, b) => a.localeCompare(b));
    return await bundleFilesInternal(sorted, root, options, skipped);
}

async function bundleFromSelection(selectionEntries, options) {
    const fileSet = new Set();
    const preSkipped = [];
    const excludedPathSet = buildExcludedPathSet(options?.excludedPaths);

    for (const entry of selectionEntries ?? []) {
        if (isPathExcluded(entry.absPath, excludedPathSet)) {
            preSkipped.push({ absPath: entry.absPath, reason: "removed from selection" });
            continue;
        }

        if (entry.kind === "folder") {
            const { files, skipped } = await listFilesRecursive(entry.absPath, {
                respectGitignore: true,
                excludedPathSet,
                collectSkipped: true,
            });
            for (const file of files) fileSet.add(file);
            preSkipped.push(...skipped);
        } else if (entry.kind === "file") {
            fileSet.add(entry.absPath);
        }
    }

    const files = Array.from(fileSet);
    const root = commonParent([...files, ...preSkipped.map((entry) => entry.absPath)]);
    const sorted = files.sort((a, b) => a.localeCompare(b));
    return await bundleFilesInternal(sorted, root, options, preSkipped);
}

async function bundleFilesInternal(absPaths, root, options, preSkipped = []) {
    const parts = [];
    let included = 0;
    const includedFiles = [];
    const skippedFiles = [];
    const skippedSeen = new Set();

    const formatLabel = (absPath) => {
        return options?.useBasenameOnly
            ? path.basename(absPath)
            : path.relative(root, absPath).replace(/\\/g, "/");
    };

    const addSkipped = (absPath, reason) => {
        const label = formatLabel(absPath);
        const key = `${label}::${reason}`;
        if (skippedSeen.has(key)) return;
        skippedSeen.add(key);
        skippedFiles.push({ path: label, reason });
    };

    for (const item of preSkipped) {
        addSkipped(item.absPath, item.reason);
    }

    for (const absPath of absPaths) {
        const label = formatLabel(absPath);
        const skipReason = await getFileSkipReason(absPath);
        if (skipReason) {
            addSkipped(absPath, skipReason);
            continue;
        }

        let content;
        try {
            content = await fs.readFile(absPath, "utf8");
        } catch {
            addSkipped(absPath, "read failed");
            continue;
        }

        content = content.replace(/\r\n/g, "\n");

        parts.push(`${label}:\n${content}`);
        included++;
        includedFiles.push(label);
    }

    return {
        output: parts.join(SEP),
        stats: { included, skipped: skippedFiles.length, total: included + skippedFiles.length },
        files: {
            included: includedFiles,
            skipped: skippedFiles,
        },
    };
}

async function listFilesRecursive(root, options = {}) {
    const files = [];
    const skipped = [];
    const gitignore = options.respectGitignore ? await loadGitignoreMatcher(root) : null;
    const excludedPathSet = options.excludedPathSet ?? new Set();
    const collectSkipped = options.collectSkipped ?? false;

    const isIgnoredByGitignore = (absPath, isDir = false) => {
        if (!gitignore) return false;
        const rel = path.relative(root, absPath).replace(/\\/g, "/");
        if (!rel || rel === ".") return false;
        return gitignore.ignores(isDir ? `${rel}/` : rel);
    };

    const addSkipped = (absPath, reason) => {
        if (!collectSkipped) return;
        skipped.push({ absPath, reason });
    };

    async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const abs = path.join(dir, entry.name);

            if (isPathExcluded(abs, excludedPathSet)) {
                addSkipped(abs, "removed from selection");
                continue;
            }

            if (entry.isDirectory()) {
                if (IGNORE_DIRS.has(entry.name)) {
                    addSkipped(abs, "ignored directory");
                    continue;
                }
                if (isIgnoredByGitignore(abs, true)) {
                    addSkipped(abs, "matched .gitignore");
                    continue;
                }
                await walk(abs);
            } else if (entry.isFile()) {
                if (isIgnoredByGitignore(abs, false)) {
                    addSkipped(abs, "matched .gitignore");
                    continue;
                }
                const skipReason = await getFileSkipReason(abs);
                if (skipReason) {
                    addSkipped(abs, skipReason);
                    continue;
                }
                files.push(abs);
            }
        }
    }

    await walk(root);
    return { files, skipped };
}

async function getSelectionHierarchy(selectionEntries, options = {}) {
    const excludedPathSet = buildExcludedPathSet(options.excludedPaths);
    const nodes = [];

    const sortedEntries = [...(selectionEntries ?? [])].sort((a, b) => a.absPath.localeCompare(b.absPath));
    for (const entry of sortedEntries) {
        if (entry.kind === "file") {
            nodes.push({
                kind: "file",
                name: path.basename(entry.absPath),
                absPath: entry.absPath,
                excluded: excludedPathSet.has(path.resolve(entry.absPath)),
                children: [],
            });
            continue;
        }

        if (entry.kind === "folder") {
            const node = await buildFolderHierarchyNode(entry.absPath, excludedPathSet);
            if (node) nodes.push(node);
        }
    }

    return { nodes };
}

async function buildFolderHierarchyNode(rootPath, excludedPathSet) {
    const gitignore = await loadGitignoreMatcher(rootPath);

    const isIgnoredByGitignore = (absPath, isDir = false) => {
        const rel = path.relative(rootPath, absPath).replace(/\\/g, "/");
        if (!rel || rel === ".") return false;
        return gitignore.ignores(isDir ? `${rel}/` : rel);
    };

    const walk = async (dirPath) => {
        const directExcluded = excludedPathSet.has(path.resolve(dirPath));

        const node = {
            kind: "folder",
            name: path.basename(dirPath),
            absPath: dirPath,
            excluded: directExcluded,
            children: [],
        };

        let entries;
        try {
            entries = await fs.readdir(dirPath, { withFileTypes: true });
        } catch {
            return node;
        }

        entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
            const abs = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                if (IGNORE_DIRS.has(entry.name)) continue;
                if (isIgnoredByGitignore(abs, true)) continue;

                const child = await walk(abs);
                if (child) node.children.push(child);
                continue;
            }

            if (entry.isFile()) {
                if (isIgnoredByGitignore(abs, false)) continue;
                const skipReason = await getFileSkipReason(abs);
                if (skipReason) continue;
                node.children.push({
                    kind: "file",
                    name: entry.name,
                    absPath: abs,
                    excluded: excludedPathSet.has(path.resolve(abs)),
                    children: [],
                });
            }
        }

        return node;
    };

    return await walk(rootPath);
}

async function loadGitignoreMatcher(root) {
    const matcher = ignore();
    const gitignorePath = path.join(root, ".gitignore");
    try {
        const raw = await fs.readFile(gitignorePath, "utf8");
        matcher.add(raw);
    } catch {
        // No .gitignore in selected root is a valid case.
    }
    return matcher;
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

function buildExcludedPathSet(excludedPaths) {
    return new Set((excludedPaths ?? []).map((value) => path.resolve(value)));
}

async function getFileSkipReason(absPath) {
    const ext = path.extname(absPath).toLowerCase();
    if (IGNORE_EXTS.has(ext)) return "ignored extension";

    let stat;
    try {
        stat = await fs.stat(absPath);
    } catch {
        return "read failed";
    }

    if (!stat.isFile()) return "not a file";
    if (stat.size > MAX_FILE_BYTES) return "too large";
    if (await sniffBinary(absPath)) return "binary";
    return null;
}

function isPathExcluded(absPath, excludedPathSet) {
    const resolved = path.resolve(absPath);
    for (const excluded of excludedPathSet) {
        if (resolved === excluded) return true;
        if (resolved.startsWith(`${excluded}${path.sep}`)) return true;
    }
    return false;
}

module.exports = { bundleFromFolder, bundleFromFiles, bundleFromSelection, getSelectionHierarchy };