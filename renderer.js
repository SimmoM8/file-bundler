const targetEl = document.getElementById("target");
const statsEl = document.getElementById("stats");
const outputEl = document.getElementById("output");
const basenameOnlyEl = document.getElementById("basenameOnly");
const detailsOverlay = document.getElementById("detailsOverlay");
const detailsListEl = document.getElementById("detailsList");
const detailsEmptyEl = document.getElementById("detailsEmpty");
const detailsSearchEl = document.getElementById("detailsSearch");
const detailsCloseEl = document.getElementById("detailsClose");
const detailsCopyEl = document.getElementById("detailsCopy");
const tabIncludedEl = document.getElementById("tabIncluded");
const tabSkippedEl = document.getElementById("tabSkipped");
const selectionSummaryEl = document.getElementById("selectionSummary");
const selectionListEl = document.getElementById("selectionList");
const selectionEmptyEl = document.getElementById("selectionEmpty");
const addContentBtn = document.getElementById("addContent");
const clearSelectionBtn = document.getElementById("clearSelection");
const selectionViewEl = document.getElementById("selectionView");
const viewSelectionBtn = document.getElementById("viewSelection");
const viewOutputBtn = document.getElementById("viewOutput");
const appMetaEl = document.getElementById("appMeta");

const SHOW_DELAY_MS = 900;
const FADE_MS = 250;
const SKIP_REPLACE_CONFIRM_KEY = "fileBundler.skipReplaceSelectionConfirm";

let selectionEntries = [];
let lastBundleMeta = null;
let lastTotalLabel = "Total";
let activeTab = "included";
let rebundleToken = 0;
let hierarchyToken = 0;
let selectionHierarchy = [];
const excludedAbsPaths = new Set();
const collapsedFolders = new Set();
const knownFolderPaths = new Set();
const animatingFolders = new Set();
const groupCompleteByPath = new Map();
const userExpandedFolders = new Set();
const knownTopGroupPaths = new Set();
const pendingAutoExpandTargets = new Set();
const knownDisplayFolderPaths = new Set();
const gitRootBySelectionPath = new Map();

const toastEl = document.getElementById("toast");
let toastTimer = null;
let scrollTimer = null;

outputEl.style.setProperty("--scroll-fade", `${FADE_MS}ms`);
statsEl.classList.add("stats");
renderStats(null);
targetEl.textContent = buildTargetLabel();
renderSelection();
setView("selection");
void renderAppMeta();

statsEl.addEventListener("click", (event) => {
    if (!statsEl.dataset.hasDetails) return;
    if (event.target.closest("button")) return;
    const statChip = event.target.closest(".statChip");
    const preferredTab = statChip?.dataset.stat === "skipped"
        ? "skipped"
        : statChip?.dataset.stat === "included"
            ? "included"
            : activeTab;
    openDetails(preferredTab);
});

outputEl.addEventListener("scroll", () => {
    outputEl.classList.add("scrolling", "scrolling-on");
    requestAnimationFrame(() => outputEl.classList.remove("scrolling-on"));
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => outputEl.classList.remove("scrolling"), SHOW_DELAY_MS);
});

outputEl.addEventListener("pointerenter", () => outputEl.classList.add("hovering"));
outputEl.addEventListener("pointerleave", () => outputEl.classList.remove("hovering"));

function toast(msg) {
    toastEl.classList.remove("success", "error");
    toastEl.classList.add("success");
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 5000);
}

function toastError(msg) {
    toastEl.classList.remove("success", "error");
    toastEl.classList.add("error");
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 5000);
}

function toErrorMessage(error, fallback) {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

async function renderAppMeta() {
    if (!appMetaEl) return;

    const currentYear = new Date().getFullYear();
    let version = "";
    let copyright = `Copyright \u00A9 ${currentYear}`;

    try {
        const info = await window.api.getAppInfo();
        if (info?.version) version = String(info.version);
        if (info?.copyright) {
            copyright = String(info.copyright).replace("Copyright \u00A9", `Copyright \u00A9 ${currentYear}`);
        }
    } catch {
        // Keep fallback metadata.
    }

    appMetaEl.textContent = version ? `${copyright} • v${version}` : copyright;
}

function getSkipReplaceConfirmPreference() {
    try {
        return localStorage.getItem(SKIP_REPLACE_CONFIRM_KEY) === "1";
    } catch {
        return false;
    }
}

function setSkipReplaceConfirmPreference(skip) {
    try {
        if (skip) {
            localStorage.setItem(SKIP_REPLACE_CONFIRM_KEY, "1");
        } else {
            localStorage.removeItem(SKIP_REPLACE_CONFIRM_KEY);
        }
    } catch {
        // Ignore storage failures.
    }
}

function confirmAction({
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    showDontAskAgain = false,
    dontAskAgainLabel = "Don't ask me again",
}) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "modalOverlay";
        overlay.setAttribute("aria-hidden", "false");

        const card = document.createElement("div");
        card.className = "modalCard glass confirmCard";
        card.setAttribute("role", "dialog");
        card.setAttribute("aria-modal", "true");

        const header = document.createElement("div");
        header.className = "modalHeader";

        const titleEl = document.createElement("div");
        titleEl.className = "modalTitle";
        titleEl.textContent = title;

        const actions = document.createElement("div");
        actions.className = "modalActions";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "btn subtle";
        cancelBtn.textContent = cancelLabel;

        const confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.className = "btn";
        confirmBtn.textContent = confirmLabel;

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        header.appendChild(titleEl);
        header.appendChild(actions);

        const body = document.createElement("div");
        body.className = "confirmBody";

        const messageEl = document.createElement("p");
        messageEl.className = "confirmMessage";
        messageEl.textContent = message;
        body.appendChild(messageEl);

        let checkbox = null;
        if (showDontAskAgain) {
            const checkboxWrap = document.createElement("label");
            checkboxWrap.className = "confirmCheckbox";

            checkbox = document.createElement("input");
            checkbox.type = "checkbox";

            const checkboxText = document.createElement("span");
            checkboxText.textContent = dontAskAgainLabel;

            checkboxWrap.appendChild(checkbox);
            checkboxWrap.appendChild(checkboxText);
            body.appendChild(checkboxWrap);
        }

        card.appendChild(header);
        card.appendChild(body);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const cleanup = () => {
            document.removeEventListener("keydown", onKeyDown);
            overlay.remove();
        };

        const done = (confirmed) => {
            const dontAskAgain = Boolean(checkbox?.checked);
            cleanup();
            resolve({ confirmed, dontAskAgain });
        };

        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                done(false);
                return;
            }
            if (event.key === "Enter") {
                event.preventDefault();
                done(true);
            }
        };

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) done(false);
        });
        cancelBtn.addEventListener("click", () => done(false));
        confirmBtn.addEventListener("click", () => done(true));
        document.addEventListener("keydown", onKeyDown);
        confirmBtn.focus();
    });
}

function normalizeStats(input) {
    if (!input) return null;

    if (typeof input === "object") {
        const { included, skipped, total } = input;
        if ([included, skipped, total].some((value) => value === undefined || value === null)) {
            return null;
        }
        const parsed = {
            included: Number(included),
            skipped: Number(skipped),
            total: Number(total)
        };
        if ([parsed.included, parsed.skipped, parsed.total].some((value) => Number.isNaN(value))) {
            return null;
        }
        return parsed;
    }

    if (typeof input === "string") {
        const match = input.match(/Included:\s*(\d+)\s*\|\s*Skipped:\s*(\d+)\s*\|\s*Total(?:\s*scanned)?:\s*(\d+)/i);
        if (!match) return null;
        return {
            included: Number(match[1]),
            skipped: Number(match[2]),
            total: Number(match[3])
        };
    }

    return null;
}

function getSelectionCounts() {
    return selectionEntries.reduce(
        (acc, entry) => {
            if (entry.kind === "folder") acc.folders += 1;
            if (entry.kind === "file") acc.files += 1;
            return acc;
        },
        { folders: 0, files: 0 }
    );
}

function normalizePath(value) {
    return String(value || "").replace(/\\/g, "/");
}

function isSameOrDescendantPath(candidate, base) {
    const left = normalizePath(candidate);
    const right = normalizePath(base);
    return left === right || left.startsWith(`${right}/`);
}

function isAlreadySelected(entry, currentSelection) {
    for (const selected of currentSelection) {
        if (selected.kind === entry.kind && normalizePath(selected.absPath) === normalizePath(entry.absPath)) {
            return true;
        }

        // If a folder is already selected, any file/folder under it is already selected.
        if (selected.kind === "folder" && isSameOrDescendantPath(entry.absPath, selected.absPath)) {
            return true;
        }
    }

    return false;
}

function pruneExcludedPaths() {
    if (selectionEntries.length === 0) {
        excludedAbsPaths.clear();
        return;
    }

    for (const excludedPath of Array.from(excludedAbsPaths)) {
        const keep = selectionEntries.some((entry) => (
            isSameOrDescendantPath(excludedPath, entry.absPath)
            || isSameOrDescendantPath(entry.absPath, excludedPath)
        ));
        if (!keep) excludedAbsPaths.delete(excludedPath);
    }
}

async function refreshSelectionHierarchy() {
    const token = ++hierarchyToken;

    if (selectionEntries.length === 0) {
        selectionHierarchy = [];
        knownFolderPaths.clear();
        collapsedFolders.clear();
        groupCompleteByPath.clear();
        renderSelection();
        return;
    }

    try {
        const res = await window.api.getSelectionHierarchy(selectionEntries, {
            excludedPaths: Array.from(excludedAbsPaths),
        });
        if (token !== hierarchyToken) return;

        selectionHierarchy = Array.isArray(res?.nodes) ? res.nodes : [];
        const visibleRootPaths = new Set(selectionHierarchy.map((node) => node.absPath));
        const beforeCount = selectionEntries.length;
        selectionEntries = selectionEntries.filter((entry) => visibleRootPaths.has(entry.absPath));
        if (selectionEntries.length !== beforeCount) {
            targetEl.textContent = buildTargetLabel();
        }
        const selectedFolderRoots = new Set(
            selectionEntries
                .filter((entry) => entry.kind === "folder")
                .map((entry) => entry.absPath)
        );
        await refreshSelectionGitRoots();
        syncFolderCollapseDefaults(selectionHierarchy, selectedFolderRoots);
        await updateGroupCompleteness(selectionHierarchy);
        renderSelection();
    } catch (error) {
        console.error("Failed to load selection hierarchy", error);
        throw new Error("Could not refresh the selection tree.");
    }
}

async function refreshSelectionGitRoots() {
    const activeSelectionPaths = new Set(selectionEntries.map((entry) => normalizePath(entry.absPath)));

    for (const knownPath of Array.from(gitRootBySelectionPath.keys())) {
        if (!activeSelectionPaths.has(knownPath)) {
            gitRootBySelectionPath.delete(knownPath);
        }
    }

    const lookups = [];
    for (const entry of selectionEntries) {
        const entryPath = normalizePath(entry.absPath);
        if (gitRootBySelectionPath.has(entryPath)) continue;

        lookups.push((async () => {
            try {
                const gitRoot = await window.api.findGitRoot(entry.absPath);
                gitRootBySelectionPath.set(entryPath, gitRoot ? normalizePath(gitRoot) : null);
            } catch {
                gitRootBySelectionPath.set(entryPath, null);
            }
        })());
    }

    if (lookups.length > 0) {
        await Promise.all(lookups);
    }
}

function getGitRootForDisplayPath(absPath) {
    const target = normalizePath(absPath);
    let bestMatchLen = -1;
    let resolvedRoot = null;

    for (const [selectionPath, gitRoot] of gitRootBySelectionPath.entries()) {
        const matchesPath = isSameOrDescendantPath(target, selectionPath) || isSameOrDescendantPath(selectionPath, target);
        if (!matchesPath) continue;
        if (selectionPath.length <= bestMatchLen) continue;
        bestMatchLen = selectionPath.length;
        resolvedRoot = gitRoot;
    }

    return resolvedRoot;
}

async function updateGroupCompleteness(hierarchyNodes) {
    groupCompleteByPath.clear();
    const displayRoots = buildDisplayRoots(hierarchyNodes);
    const groups = [];

    const collectSelectedFilePaths = (nodes, ancestorExcluded = false, out = new Set()) => {
        for (const node of nodes ?? []) {
            const directExcluded = node.excluded === true;
            const effectiveExcluded = ancestorExcluded || directExcluded;
            if (node.kind === "file" && !effectiveExcluded) {
                out.add(node.absPath);
            }
            collectSelectedFilePaths(node.children, effectiveExcluded, out);
        }
        return out;
    };

    const collectAllFilePaths = (nodes, out = new Set()) => {
        for (const node of nodes ?? []) {
            if (node.kind === "file") out.add(node.absPath);
            collectAllFilePaths(node.children, out);
        }
        return out;
    };

    const selectedFilePaths = collectSelectedFilePaths(hierarchyNodes);

    const collectGroups = (nodes) => {
        for (const node of nodes) {
            if (node.kind === "group") groups.push(node);
            if (node.children?.length) collectGroups(node.children);
        }
    };

    collectGroups(displayRoots);

    for (const group of groups) {
        try {
            const res = await window.api.getSelectionHierarchy(
                [{ kind: "folder", absPath: group.absPath }],
                { excludedPaths: Array.from(excludedAbsPaths) }
            );
            const root = Array.isArray(res?.nodes)
                ? res.nodes.find((node) => node.kind === "folder" && node.absPath === group.absPath) || res.nodes[0]
                : null;

            const expectedChildren = root?.children ?? [];
            if (expectedChildren.length === 0) {
                groupCompleteByPath.set(group.absPath, false);
                continue;
            }

            const complete = expectedChildren.every((child) => {
                if (child.kind === "file") {
                    return selectedFilePaths.has(child.absPath);
                }

                if (child.kind === "folder") {
                    const expectedFiles = collectAllFilePaths(child.children);
                    if (expectedFiles.size === 0) return false;

                    for (const filePath of expectedFiles) {
                        if (!selectedFilePaths.has(filePath)) return false;
                    }
                    return true;
                }

                return false;
            });

            groupCompleteByPath.set(group.absPath, complete);
        } catch {
            groupCompleteByPath.set(group.absPath, false);
        }
    }
}

function syncFolderCollapseDefaults(nodes, selectedFolderRoots) {
    const currentFolderPaths = new Set();

    const walk = (nodeList) => {
        for (const node of nodeList) {
            if (node.kind === "folder") {
                currentFolderPaths.add(node.absPath);
                if (!knownFolderPaths.has(node.absPath)) {
                    knownFolderPaths.add(node.absPath);
                    if (selectedFolderRoots.has(node.absPath)) {
                        collapsedFolders.delete(node.absPath);
                    } else {
                        collapsedFolders.add(node.absPath);
                    }
                }
            }
            if (node.children?.length) walk(node.children);
        }
    };

    walk(nodes);

    for (const known of Array.from(knownFolderPaths)) {
        if (!currentFolderPaths.has(known)) {
            knownFolderPaths.delete(known);
            collapsedFolders.delete(known);
        }
    }
}

function applyGroupedCollapseDefaults(displayRoots) {
    const topGroups = displayRoots.filter((node) => node.kind === "group");
    const currentTopGroupPaths = new Set(topGroups.map((node) => node.absPath));

    for (const group of topGroups) {
        if (!knownTopGroupPaths.has(group.absPath)) {
            knownTopGroupPaths.add(group.absPath);
            collapsedFolders.delete(group.absPath);
        }
        if (!knownDisplayFolderPaths.has(group.absPath)) {
            knownDisplayFolderPaths.add(group.absPath);
        }

        if (userExpandedFolders.has(group.absPath)) {
            collapsedFolders.delete(group.absPath);
        }

        const walkChildren = (children) => {
            for (const child of children ?? []) {
                const isFolderLike = child.kind === "folder" || child.kind === "group";
                if (isFolderLike) {
                    if (!knownDisplayFolderPaths.has(child.absPath)) {
                        knownDisplayFolderPaths.add(child.absPath);
                        if (userExpandedFolders.has(child.absPath)) {
                            collapsedFolders.delete(child.absPath);
                        } else {
                            collapsedFolders.add(child.absPath);
                        }
                    } else if (userExpandedFolders.has(child.absPath)) {
                        collapsedFolders.delete(child.absPath);
                    }
                }
                walkChildren(child.children);
            }
        };

        walkChildren(group.children);
    }

    for (const knownPath of Array.from(knownTopGroupPaths)) {
        if (!currentTopGroupPaths.has(knownPath)) {
            knownTopGroupPaths.delete(knownPath);
        }
    }

    const currentDisplayFolderPaths = new Set();
    const collectDisplayFolders = (nodes) => {
        for (const node of nodes ?? []) {
            if (node.kind === "folder" || node.kind === "group") {
                currentDisplayFolderPaths.add(node.absPath);
            }
            collectDisplayFolders(node.children);
        }
    };
    collectDisplayFolders(displayRoots);

    for (const knownPath of Array.from(knownDisplayFolderPaths)) {
        if (!currentDisplayFolderPaths.has(knownPath)) {
            knownDisplayFolderPaths.delete(knownPath);
            userExpandedFolders.delete(knownPath);
            collapsedFolders.delete(knownPath);
        }
    }
}

async function addEntries(newEntries) {
    const next = new Map(selectionEntries.map((entry) => [`${entry.kind}:${entry.absPath}`, entry]));
    const newlyAddedPaths = new Set();
    for (const entry of newEntries) {
        if (entry.kind === "folder") {
            for (const [key, existing] of Array.from(next.entries())) {
                if (normalizePath(existing.absPath) === normalizePath(entry.absPath)) continue;
                if (isSameOrDescendantPath(existing.absPath, entry.absPath)) {
                    next.delete(key);
                }
            }
        }
        const entryKey = `${entry.kind}:${entry.absPath}`;
        if (!next.has(entryKey)) {
            newlyAddedPaths.add(entry.absPath);
        }
        next.set(`${entry.kind}:${entry.absPath}`, entry);
        excludedAbsPaths.delete(entry.absPath);
    }
    selectionEntries = Array.from(next.values());
    pruneExcludedPaths();
    lastBundleMeta = null;
    outputEl.value = "";
    targetEl.textContent = buildTargetLabel();
    renderStats(null);
    for (const absPath of newlyAddedPaths) {
        pendingAutoExpandTargets.add(absPath);
    }
    await refreshSelectionHierarchy();
    await rebundleSelectionLive();
    return {
        addedCount: newlyAddedPaths.size,
        totalCount: selectionEntries.length,
    };
}

function resetSelectionState() {
    selectionEntries = [];
    selectionHierarchy = [];
    excludedAbsPaths.clear();
    collapsedFolders.clear();
    knownFolderPaths.clear();
    groupCompleteByPath.clear();
    userExpandedFolders.clear();
    knownTopGroupPaths.clear();
    pendingAutoExpandTargets.clear();
    knownDisplayFolderPaths.clear();
    gitRootBySelectionPath.clear();
    lastBundleMeta = null;
    lastTotalLabel = "Total";
    outputEl.value = "";
    targetEl.textContent = buildTargetLabel();
    renderSelection();
    renderStats(null);
}

async function toggleEntryBundled(absPath, includeInBundle) {
    if (includeInBundle) {
        excludedAbsPaths.delete(absPath);
    } else {
        excludedAbsPaths.add(absPath);
    }

    pruneExcludedPaths();
    lastBundleMeta = null;
    renderStats(null);
    await refreshSelectionHierarchy();
    await rebundleSelectionLive();
}

function summarizeSelection() {
    const counts = getSelectionCounts();
    return `Selected: ${counts.folders} folder${counts.folders === 1 ? "" : "s"}, ${counts.files} file${counts.files === 1 ? "" : "s"}`;
}

function buildTargetLabel() {
    if (selectionEntries.length === 0) return "(no target selected)";

    const getPathParts = (absPath) => String(absPath).replace(/\\/g, "/").split("/").filter(Boolean);
    const getName = (absPath) => {
        const parts = getPathParts(absPath);
        return parts[parts.length - 1] || absPath;
    };
    const getParentName = (absPath) => {
        const parts = getPathParts(absPath);
        return parts.length >= 2 ? parts[parts.length - 2] : "root";
    };
    const pluralize = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;

    if (selectionEntries.length === 1) {
        const only = selectionEntries[0];
        return `Selected "${getName(only.absPath)}" from "${getParentName(only.absPath)}"`;
    }

    const counts = getSelectionCounts();
    const allParentPaths = selectionEntries.map((entry) => {
        const parts = getPathParts(entry.absPath);
        return parts.slice(0, -1);
    });

    const common = [];
    const shortest = Math.min(...allParentPaths.map((parts) => parts.length));
    for (let i = 0; i < shortest; i += 1) {
        const segment = allParentPaths[0][i];
        if (allParentPaths.some((parts) => parts[i] !== segment)) break;
        common.push(segment);
    }

    const parentName = common.length > 0 ? common[common.length - 1] : getParentName(selectionEntries[0].absPath);
    const parts = [];
    if (counts.folders > 0) parts.push(pluralize(counts.folders, "folder", "folders"));
    if (counts.files > 0) parts.push(pluralize(counts.files, "file", "files"));
    const selectionSummary = parts.join(" and ");
    return `Selected ${selectionSummary} from "${parentName}"`;
}

function getParentPath(absPath) {
    const normalized = String(absPath).replace(/\\/g, "/");
    const idx = normalized.lastIndexOf("/");
    if (idx <= 0) return normalized;
    return normalized.slice(0, idx);
}

function getBaseName(absPath) {
    const normalized = String(absPath).replace(/\\/g, "/");
    const idx = normalized.lastIndexOf("/");
    if (idx < 0) return normalized;
    return normalized.slice(idx + 1) || normalized;
}

function buildDisplayRoots(nodes) {
    const createGroupNode = (groupPath) => {
        const completeness = groupCompleteByPath.get(groupPath);
        return {
            kind: "group",
            name: getBaseName(groupPath),
            absPath: groupPath,
            parentPath: getParentPath(groupPath),
            excluded: excludedAbsPaths.has(groupPath),
            partial: completeness === false,
            children: [],
        };
    };

    const sortTree = (items) => {
        items.sort((a, b) => a.name.localeCompare(b.name));
        for (const item of items) {
            if (item.children?.length) sortTree(item.children);
        }
    };

    const signature = (list) => list
        .map((node) => `${node.kind}:${node.absPath}`)
        .sort()
        .join("|");

    const groupOnce = (list) => {
        const groupedByParent = new Map();

        const canGroupUnderParent = (parentPath, siblings) => {
            for (const sibling of siblings) {
                const gitRoot = getGitRootForDisplayPath(sibling.absPath);
                if (gitRoot && !isSameOrDescendantPath(parentPath, gitRoot)) {
                    return false;
                }
            }
            return true;
        };

        for (const node of list) {
            const parentPath = getParentPath(node.absPath);
            if (!groupedByParent.has(parentPath)) groupedByParent.set(parentPath, []);
            groupedByParent.get(parentPath).push(node);
        }

        const next = [];
        let groupedAny = false;

        for (const [parentPath, siblings] of groupedByParent.entries()) {
            if (siblings.length <= 1) {
                next.push(...siblings);
                continue;
            }

            if (!canGroupUnderParent(parentPath, siblings)) {
                next.push(...siblings);
                continue;
            }

            groupedAny = true;
            const groupNode = createGroupNode(parentPath);
            groupNode.parentPath = parentPath;
            groupNode.children = siblings;
            next.push(groupNode);
        }

        return { next, groupedAny };
    };

    const bridgeByAncestor = (list) => {
        const buildNestedBridgeGroup = (ancestor, members) => {
            const root = createGroupNode(ancestor);
            root.parentPath = ancestor;

            const childKey = (child) => `${child.kind}:${child.absPath}`;
            const pushUniqueChild = (container, child) => {
                const key = childKey(child);
                if (container.children.some((existing) => childKey(existing) === key)) return;
                container.children.push(child);
            };

            const ensureGroupChild = (container, groupPath) => {
                const existing = container.children.find(
                    (child) => child.kind === "group" && child.absPath === groupPath
                );
                if (existing) return existing;
                const nextGroup = createGroupNode(groupPath);
                container.children.push(nextGroup);
                return nextGroup;
            };

            for (const member of members) {
                if (member.kind === "group" && member.absPath === ancestor) {
                    for (const child of member.children ?? []) {
                        pushUniqueChild(root, child);
                    }
                    continue;
                }

                const memberParent = getParentPath(member.absPath);
                if (memberParent === ancestor) {
                    pushUniqueChild(root, member);
                    continue;
                }

                const relParent = memberParent.slice(ancestor.length).replace(/^\/+/, "");
                if (!relParent) {
                    root.children.push(member);
                    continue;
                }

                const segments = relParent.split("/").filter(Boolean);
                let cursor = root;
                let accum = ancestor;
                for (const segment of segments) {
                    accum = `${accum}/${segment}`;
                    cursor = ensureGroupChild(cursor, accum);
                }
                pushUniqueChild(cursor, member);
            }

            sortTree(root.children);
            return root;
        };

        const candidateAncestors = new Set();
        for (const node of list) {
            if (node.kind !== "folder" && node.kind !== "group") continue;
            candidateAncestors.add(getParentPath(node.absPath));
            candidateAncestors.add(node.absPath);
        }
        const sortedCandidates = Array.from(candidateAncestors)
            .sort((a, b) => b.length - a.length);

        const used = new Set();
        const bridgedGroups = [];

        for (const ancestor of sortedCandidates) {
            const members = [];
            let hasDirectChild = false;

            for (const node of list) {
                if (used.has(node.absPath)) continue;
                if (!isSameOrDescendantPath(node.absPath, ancestor)) continue;

                const gitRoot = getGitRootForDisplayPath(node.absPath);
                if (gitRoot && !isSameOrDescendantPath(ancestor, gitRoot)) continue;

                members.push(node);
                if (getParentPath(node.absPath) === ancestor || node.absPath === ancestor) {
                    hasDirectChild = true;
                }
            }

            if (members.length < 2 || !hasDirectChild) continue;

            for (const node of members) {
                used.add(node.absPath);
            }

            bridgedGroups.push(buildNestedBridgeGroup(ancestor, members));
        }

        const remainder = list.filter((node) => !used.has(node.absPath));
        return [...remainder, ...bridgedGroups];
    };

    let current = [...nodes];
    let previousSig = "";

    while (true) {
        const { next, groupedAny } = groupOnce(current);
        const nextSig = signature(next);
        current = next;

        if (!groupedAny || nextSig === previousSig) break;
        previousSig = nextSig;
    }

    let bridgePrevSig = "";
    while (true) {
        const bridged = bridgeByAncestor(current);
        const bridgedSig = signature(bridged);
        current = bridged;
        if (bridgedSig === bridgePrevSig) break;
        bridgePrevSig = bridgedSig;
    }

    return current.sort((a, b) => a.name.localeCompare(b.name));
}

async function rebundleSelectionLive() {
    const token = ++rebundleToken;

    if (selectionEntries.length === 0) {
        outputEl.value = "";
        lastBundleMeta = null;
        lastTotalLabel = "Total";
        renderStats(null);
        setView("selection");
        return { status: "empty" };
    }

    try {
        const options = {
            useBasenameOnly: basenameOnlyEl.checked,
            excludedPaths: Array.from(excludedAbsPaths),
        };
        const res = await window.api.bundleSelection(selectionEntries, options);
        if (token !== rebundleToken) return { status: "stale" };

        outputEl.value = res.output;
        lastBundleMeta = res;
        lastTotalLabel = "Total";
        renderStats(res.stats);
        return { status: "success" };
    } catch (error) {
        console.error("Live rebundle failed", error);
        throw new Error("Failed to rebundle with the current options.");
    }
}

function renderSelection() {
    const displayRoots = buildDisplayRoots(selectionHierarchy);
    applyGroupedCollapseDefaults(displayRoots);

    if (pendingAutoExpandTargets.size > 0) {
        const keepExpandedPaths = new Set();

        const expandIfContainsNewTarget = (node) => {
            let hasTarget = pendingAutoExpandTargets.has(node.absPath);

            for (const child of node.children ?? []) {
                if (expandIfContainsNewTarget(child)) {
                    hasTarget = true;
                }
            }

            const isFolderLike = node.kind === "folder" || node.kind === "group";
            if (isFolderLike && hasTarget) {
                keepExpandedPaths.add(node.absPath);
            }

            return hasTarget;
        };

        for (const node of displayRoots) {
            expandIfContainsNewTarget(node);
        }

        const applyFocusCollapse = (nodes) => {
            for (const node of nodes ?? []) {
                const isFolderLike = node.kind === "folder" || node.kind === "group";
                if (isFolderLike) {
                    if (keepExpandedPaths.has(node.absPath)) {
                        collapsedFolders.delete(node.absPath);
                    } else {
                        collapsedFolders.add(node.absPath);
                        userExpandedFolders.delete(node.absPath);
                    }
                }
                applyFocusCollapse(node.children);
            }
        };

        applyFocusCollapse(displayRoots);
        pendingAutoExpandTargets.clear();
    }

    const counts = { folders: 0, files: 0 };

    const countNodes = (node) => {
        if (node.kind === "folder") counts.folders += 1;
        if (node.kind === "file") counts.files += 1;
        for (const child of node.children ?? []) countNodes(child);
    };

    for (const node of displayRoots) countNodes(node);
    const total = counts.folders + counts.files;
    const hasSelection = selectionEntries.length > 0;
    addContentBtn.classList.toggle("hidden", !hasSelection);
    clearSelectionBtn.classList.toggle("hidden", !hasSelection);

    selectionSummaryEl.textContent = `Bundled tree: ${total} items (folders ${counts.folders}, files ${counts.files})`;

    selectionListEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    const renderNode = (node, depth, ancestorExcluded = false) => {
        const isGroup = node.kind === "group";
        const isFolder = node.kind === "folder" || isGroup;
        const hasChildren = Boolean(node.children?.length);
        const collapsed = isFolder && collapsedFolders.has(node.absPath);
        const directExcluded = node.excluded === true;
        const effectiveExcluded = ancestorExcluded || directExcluded;

        const group = document.createElement("div");
        group.className = "selectionTreeGroup";
        group.classList.toggle("isRemovedGroup", isFolder && directExcluded);

        const row = document.createElement("div");
        row.className = "selectionTreeRow";
        row.style.setProperty("--tree-depth", String(depth));
        row.classList.toggle("isRemoved", !isFolder && directExcluded);

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "selectionTreeToggle";
        toggle.textContent = isFolder ? (collapsed ? "▸" : "▾") : "";
        toggle.dataset.path = node.absPath;
        toggle.style.visibility = isFolder && hasChildren ? "visible" : "hidden";
        toggle.setAttribute("aria-label", collapsed ? "Expand folder" : "Collapse folder");

        const icon = document.createElement("div");
        icon.className = "selectionTreeIcon";
        icon.textContent = isFolder ? "📁" : "📄";

        const name = document.createElement("div");
        name.className = "selectionTreeName";
        name.textContent = node.name;

        const nameLine = document.createElement("div");
        nameLine.className = "selectionTreeNameLine";
        nameLine.appendChild(name);

        const textWrap = document.createElement("div");
        textWrap.className = "selectionTreeText";
        textWrap.appendChild(nameLine);

        if (node.partial) {
            const flag = document.createElement("span");
            flag.className = "selectionTreeFlag";
            flag.textContent = "Partial";
            nameLine.appendChild(flag);
        }

        if (depth === 0 && !isGroup) {
            const meta = document.createElement("div");
            meta.className = "selectionTreeMeta";
            meta.textContent = `from \"${getParentPath(node.absPath)}\"`;
            textWrap.appendChild(meta);
        }

        if (isGroup && depth === 0) {
            const meta = document.createElement("div");
            meta.className = "selectionTreeMeta";
            meta.textContent = `from \"${getParentPath(node.parentPath)}\"`;
            textWrap.appendChild(meta);
        }

        const removeBtn = document.createElement("button");
        removeBtn.className = "selectionRemove";
        removeBtn.type = "button";
        removeBtn.dataset.path = node.absPath;
        removeBtn.dataset.kind = node.kind;
        removeBtn.dataset.action = "remove";

        if (directExcluded) {
            removeBtn.textContent = "Re-add";
            removeBtn.dataset.action = "add";
            removeBtn.classList.add("isAdd");
            removeBtn.setAttribute("aria-label", `Add ${node.name} back to bundle`);
        } else if (effectiveExcluded) {
            removeBtn.textContent = "Removed";
            removeBtn.disabled = true;
            removeBtn.classList.add("isDisabled");
            removeBtn.setAttribute("aria-label", `${node.name} removed by parent folder`);
        } else {
            removeBtn.textContent = "Remove";
            removeBtn.setAttribute("aria-label", `Remove ${node.name} from bundle`);
        }

        row.appendChild(toggle);
        row.appendChild(icon);
        row.appendChild(textWrap);
        row.appendChild(removeBtn);
        group.appendChild(row);

        if (isFolder && hasChildren && !collapsed) {
            const childrenWrap = document.createElement("div");
            childrenWrap.className = "selectionTreeChildren";
            for (const child of node.children) {
                childrenWrap.appendChild(renderNode(child, depth + 1, effectiveExcluded));
            }
            group.appendChild(childrenWrap);
        }

        return group;
    };

    for (const node of displayRoots) {
        frag.appendChild(renderNode(node, 0));
    }

    selectionListEl.appendChild(frag);
    selectionEmptyEl.style.display = total === 0 ? "grid" : "none";
}

function findFolderToggle(path) {
    const toggles = selectionListEl.querySelectorAll(".selectionTreeToggle");
    for (const toggle of toggles) {
        if (toggle.dataset.path === path) return toggle;
    }
    return null;
}

async function animateFolderToggle(path) {
    if (animatingFolders.has(path)) return;
    animatingFolders.add(path);

    try {
        const isCollapsed = collapsedFolders.has(path);

        if (isCollapsed) {
            collapsedFolders.delete(path);
            userExpandedFolders.add(path);
            renderSelection();

            const expandedToggle = findFolderToggle(path);
            const expandedGroup = expandedToggle?.closest(".selectionTreeGroup");
            const expandedChildren = expandedGroup?.querySelector(":scope > .selectionTreeChildren");
            if (expandedChildren) {
                expandedChildren.classList.remove("isExpanding");
                void expandedChildren.offsetWidth;
                expandedChildren.classList.add("isExpanding");
                expandedChildren.addEventListener("animationend", () => {
                    expandedChildren.classList.remove("isExpanding");
                }, { once: true });
            }
            return;
        }

        const toggle = findFolderToggle(path);
        const group = toggle?.closest(".selectionTreeGroup");
        const childrenWrap = group?.querySelector(":scope > .selectionTreeChildren");

        if (!childrenWrap) {
            collapsedFolders.add(path);
            renderSelection();
            return;
        }

        const startHeight = childrenWrap.scrollHeight;
        childrenWrap.style.overflow = "hidden";
        childrenWrap.style.maxHeight = `${startHeight}px`;
        childrenWrap.style.opacity = "1";
        childrenWrap.style.transform = "translateY(0px)";
        childrenWrap.style.transition = "max-height 180ms ease, opacity 150ms ease, transform 180ms ease";

        requestAnimationFrame(() => {
            childrenWrap.style.maxHeight = "0px";
            childrenWrap.style.opacity = "0";
            childrenWrap.style.transform = "translateY(-6px)";
        });

        await new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                childrenWrap.removeEventListener("transitionend", onTransitionEnd);
                resolve();
            };

            const onTransitionEnd = (event) => {
                if (event.propertyName === "max-height") finish();
            };

            childrenWrap.addEventListener("transitionend", onTransitionEnd);
            setTimeout(finish, 260);
        });

        collapsedFolders.add(path);
        userExpandedFolders.delete(path);
        renderSelection();
    } finally {
        animatingFolders.delete(path);
    }
}

function setView(view) {
    const isOutput = view === "output";
    outputEl.classList.toggle("hidden", !isOutput);
    selectionViewEl.classList.toggle("hidden", isOutput);
    viewSelectionBtn.classList.toggle("active", !isOutput);
    viewOutputBtn.classList.toggle("active", isOutput);
    viewSelectionBtn.setAttribute("aria-selected", String(!isOutput));
    viewOutputBtn.setAttribute("aria-selected", String(isOutput));
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildHoverList(title, items, options = {}) {
    if (!items || items.length === 0) return "";
    const maxItems = options.maxItems ?? 12;
    const shown = items.slice(0, maxItems);
    const remaining = Math.max(items.length - shown.length, 0);

    const rows = shown.map((item) => {
        const path = item?.path ?? item;
        const base = String(path).split("/").pop();
        return `<div class="statHoverRow"><span class="statHoverPath">${escapeHtml(base || path)}</span></div>`;
    }).join("");

    const footer = remaining > 0
        ? `<div class="statHoverFooter">+${remaining} more</div>`
        : "";

    return `
        <div class="statHover" role="tooltip" aria-label="${escapeHtml(title)} files">
            <div class="statHoverTitle">${escapeHtml(title)}</div>
            <div class="statHoverList">${rows}</div>
            ${footer}
        </div>
    `;
}

function renderStats(statsInput) {
    const stats = normalizeStats(statsInput);

    if (!stats) {
        statsEl.dataset.hasDetails = "";
        statsEl.innerHTML = `
            <div class="statChip statChipPlaceholder" aria-hidden="true">
                <span class="statLabel">Included</span>
                <span class="statValue">—</span>
            </div>
            <div class="statChip statChipPlaceholder" aria-hidden="true">
                <span class="statLabel">Skipped</span>
                <span class="statValue">—</span>
            </div>
            <div class="statChip statChipPlaceholder" aria-hidden="true">
                <span class="statLabel">${lastTotalLabel}</span>
                <span class="statValue">—</span>
            </div>
        `;
        return;
    }

    const includedHover = lastBundleMeta?.files?.included?.length
        ? buildHoverList("Included files", lastBundleMeta.files.included)
        : "";
    const skippedHover = lastBundleMeta?.files?.skipped?.length
        ? buildHoverList("Skipped files", lastBundleMeta.files.skipped)
        : "";

    statsEl.dataset.hasDetails = lastBundleMeta ? "1" : "";
    statsEl.innerHTML = `
        <div class="statChip" data-stat="included">
            <span class="statLabel">Included</span>
            <span class="statValue">${stats.included}</span>
            ${stats.included > 0 ? includedHover : ""}
        </div>
        <div class="statChip" data-stat="skipped">
            <span class="statLabel">Skipped</span>
            <span class="statValue">${stats.skipped}</span>
            ${stats.skipped > 0 ? skippedHover : ""}
        </div>
        <div class="statChip">
            <span class="statLabel">${lastTotalLabel}</span>
            <span class="statValue">${stats.total}</span>
        </div>
    `;

    attachHoverPositioning();
}

function attachHoverPositioning() {
    const chips = statsEl.querySelectorAll(".statChip");
    chips.forEach((chip) => {
        const hover = chip.querySelector(".statHover");
        if (!hover) return;

        const position = () => positionHoverPanel(chip, hover);
        let closeTimer = null;

        const open = () => {
            clearTimeout(closeTimer);
            chip.classList.add("hover-open");
            position();
        };

        const close = () => {
            chip.classList.remove("hover-open");
        };

        chip.addEventListener("mouseenter", open);
        chip.addEventListener("mouseleave", () => {
            closeTimer = setTimeout(close, 120);
        });

        hover.addEventListener("mouseenter", open);
        hover.addEventListener("mouseleave", () => {
            closeTimer = setTimeout(close, 120);
        });

        window.addEventListener("resize", position);
        window.addEventListener("scroll", position, true);
    });
}

function positionHoverPanel(chipEl, hoverEl) {
    hoverEl.style.left = "0px";
    hoverEl.style.right = "auto";
    hoverEl.style.top = "calc(100% + 8px)";
    hoverEl.style.bottom = "auto";

    requestAnimationFrame(() => {
        const padding = 8;
        const chipRect = chipEl.getBoundingClientRect();
        const hoverRect = hoverEl.getBoundingClientRect();

        let shiftX = 0;
        const overflowRight = hoverRect.right - (window.innerWidth - padding);
        if (overflowRight > 0) shiftX -= overflowRight;
        const overflowLeft = hoverRect.left - padding;
        if (overflowLeft < 0) shiftX -= overflowLeft;
        if (shiftX !== 0) {
            hoverEl.style.left = `${shiftX}px`;
        }

        const overflowBottom = hoverRect.bottom - (window.innerHeight - padding);
        if (overflowBottom > 0 && chipRect.top - hoverRect.height - padding > 0) {
            hoverEl.style.top = "auto";
            hoverEl.style.bottom = `calc(100% + 8px)`;
        }
    });
}

function setActiveTab(tab) {
    activeTab = tab;
    tabIncludedEl.classList.toggle("active", tab === "included");
    tabSkippedEl.classList.toggle("active", tab === "skipped");
    tabIncludedEl.setAttribute("aria-selected", tab === "included");
    tabSkippedEl.setAttribute("aria-selected", tab === "skipped");
    renderDetailsList();
}

function openDetails(preferredTab = activeTab) {
    if (!lastBundleMeta) return;
    detailsOverlay.classList.remove("hidden");
    detailsOverlay.setAttribute("aria-hidden", "false");
    setActiveTab(preferredTab || "included");
    detailsSearchEl.focus();
    detailsSearchEl.select();
}

function closeDetails() {
    detailsOverlay.classList.add("hidden");
    detailsOverlay.setAttribute("aria-hidden", "true");
}

function renderDetailsList() {
    if (!lastBundleMeta) return;
    const query = detailsSearchEl.value.trim().toLowerCase();
    const items = activeTab === "included"
        ? lastBundleMeta.files.included.map((path) => ({ path }))
        : lastBundleMeta.files.skipped;

    const filtered = query
        ? items.filter((item) => item.path.toLowerCase().includes(query))
        : items;

    detailsListEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (const item of filtered) {
        const row = document.createElement("div");
        row.className = "detailsRow";

        const pathEl = document.createElement("div");
        pathEl.className = "detailsPath";
        pathEl.textContent = item.path;

        row.appendChild(pathEl);

        if (activeTab === "skipped" && item.reason) {
            const reasonEl = document.createElement("div");
            reasonEl.className = "detailsReason";
            reasonEl.textContent = item.reason;
            row.appendChild(reasonEl);
        }

        frag.appendChild(row);
    }

    detailsListEl.appendChild(frag);
    const hasItems = filtered.length > 0;
    detailsEmptyEl.style.display = hasItems ? "none" : "grid";
}

async function pickContent({ replace }) {
    try {
        const picked = await window.api.pickEntries();
        if (!picked || picked.length === 0) {
            toastError(replace ? "Selection unchanged." : "No content selected.");
            return;
        }

        const entries = await Promise.all(
            picked.map(async (absPath) => {
                const stat = await window.api.statPath(absPath);
                if (stat?.isDirectory) return { kind: "folder", absPath };
                if (stat?.isFile) return { kind: "file", absPath };
                return null;
            })
        );

        const validEntries = entries.filter(Boolean);
        if (validEntries.length === 0) {
            toastError("No valid files or folders were selected.");
            return;
        }

        let nextEntries = validEntries;
        let skippedCount = 0;
        if (!replace) {
            const before = validEntries.length;
            nextEntries = validEntries.filter((entry) => !isAlreadySelected(entry, selectionEntries));
            skippedCount = before - nextEntries.length;
        }

        if (nextEntries.length === 0) {
            toastError("No new content was added. Everything is already selected.");
            return;
        }

        if (replace) resetSelectionState();
        lastTotalLabel = "Total";
        const { addedCount } = await addEntries(nextEntries);
        const label = `${addedCount} item${addedCount === 1 ? "" : "s"}`;

        if (replace) {
            toast(`Selected ${label}.`);
            return;
        }

        const skippedTail = skippedCount > 0
            ? ` (${skippedCount} already selected)`
            : "";
        toast(`Added ${label} to selection${skippedTail}.`);
    } catch (error) {
        console.error("Failed to pick content", error);
        const fallback = replace
            ? "Could not replace the current selection."
            : "Could not add content to the selection.";
        toastError(toErrorMessage(error, fallback));
    }
}

document.getElementById("pickEntries").addEventListener("click", async () => {
    try {
        if (selectionEntries.length > 0 && !getSkipReplaceConfirmPreference()) {
            const { confirmed, dontAskAgain } = await confirmAction({
                title: "Replace current selection?",
                message: "Selecting content here replaces your current selection with a new one.",
                confirmLabel: "Replace selection",
                cancelLabel: "Keep current",
                showDontAskAgain: true,
                dontAskAgainLabel: "Don't ask me again",
            });

            if (!confirmed) {
                toast("Kept current selection.");
                return;
            }
            if (dontAskAgain) {
                setSkipReplaceConfirmPreference(true);
            }
        }

        await pickContent({ replace: true });
    } catch (error) {
        console.error("Failed to start selection", error);
        toastError(toErrorMessage(error, "Could not start content selection."));
    }
});

document.getElementById("addContent").addEventListener("click", async () => {
    await pickContent({ replace: false });
});

document.getElementById("clearSelection").addEventListener("click", async () => {
    try {
        if (selectionEntries.length === 0) return;

        const { confirmed } = await confirmAction({
            title: "Clear current selection?",
            message: "This removes all selected files and folders and resets the panel.",
            confirmLabel: "Clear selection",
            cancelLabel: "Cancel",
        });

        if (!confirmed) {
            toast("Selection kept.");
            return;
        }

        resetSelectionState();
        toast("Selection cleared.");
    } catch (error) {
        console.error("Failed to clear selection", error);
        toastError(toErrorMessage(error, "Could not clear the selection."));
    }
});

basenameOnlyEl.addEventListener("change", async () => {
    if (selectionEntries.length === 0) return;
    try {
        const result = await rebundleSelectionLive();
        if (result?.status === "success") {
            const mode = basenameOnlyEl.checked ? "base names" : "relative paths";
            toast(`Rebundled using ${mode}.`);
        }
    } catch (error) {
        console.error("Failed to rebundle after basename toggle", error);
        toastError(toErrorMessage(error, "Could not rebundle after toggling Base names."));
    }
});

selectionListEl.addEventListener("click", async (event) => {
    const toggle = event.target.closest(".selectionTreeToggle");
    if (toggle?.dataset.path) {
        void animateFolderToggle(toggle.dataset.path);
        return;
    }

    const button = event.target.closest(".selectionRemove");
    if (!button) return;
    if (button.disabled) return;

    const row = button.closest(".selectionTreeRow");
    const entryName = row?.querySelector(".selectionTreeName")?.textContent?.trim() || "item";

    try {
        const action = button.dataset.action;
        if (action === "add") {
            await toggleEntryBundled(button.dataset.path, true);
            toast(`Re-added ${entryName} to bundle.`);
            return;
        }
        await toggleEntryBundled(button.dataset.path, false);
        toast(`Removed ${entryName} from bundle.`);
    } catch (error) {
        console.error("Failed to toggle bundled state", error);
        toastError(toErrorMessage(error, "Could not update bundled state for that item."));
    }
});

viewSelectionBtn.addEventListener("click", () => setView("selection"));
viewOutputBtn.addEventListener("click", () => setView("output"));

function setDropActive(active) {
    selectionViewEl.classList.toggle("dropActive", active);
}

function isFileDrop(event) {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

selectionViewEl.addEventListener("dragenter", (event) => {
    if (!isFileDrop(event)) return;
    event.preventDefault();
    setDropActive(true);
});

selectionViewEl.addEventListener("dragover", (event) => {
    if (!isFileDrop(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
});

selectionViewEl.addEventListener("dragleave", (event) => {
    if (!selectionViewEl.contains(event.relatedTarget)) {
        setDropActive(false);
    }
});

selectionViewEl.addEventListener("drop", async (event) => {
    if (!isFileDrop(event)) return;
    event.preventDefault();
    setDropActive(false);

    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) return;

    try {
        const entries = await Promise.all(
            files.map(async (file) => {
                const absPath = file.path;
                const stat = await window.api.statPath(absPath);
                if (stat?.isDirectory) return { kind: "folder", absPath };
                if (stat?.isFile) return { kind: "file", absPath };
                return null;
            })
        );

        const validEntries = entries.filter(Boolean);
        if (validEntries.length === 0) {
            toastError("No valid files or folders were dropped.");
            return;
        }

        const { addedCount } = await addEntries(validEntries);
        toast(`Added ${addedCount} item${addedCount === 1 ? "" : "s"} to selection.`);
    } catch (error) {
        console.error("Failed to add dropped files", error);
        toastError(toErrorMessage(error, "Could not add dropped content to selection."));
    }
});

// Bundling is live; no manual bundle action is required.

document.getElementById("copy").addEventListener("click", async () => {
    try {
        if (!outputEl.value.trim()) {
            toastError("Nothing to copy yet.");
            return;
        }

        await window.api.copyToClipboard(outputEl.value);
        toast("Copied output to clipboard.");
    } catch (error) {
        console.error("Failed to copy output", error);
        toastError(toErrorMessage(error, "Could not copy output to clipboard."));
    }
});

detailsOverlay.addEventListener("click", (event) => {
    if (event.target === detailsOverlay) closeDetails();
});

detailsCloseEl.addEventListener("click", closeDetails);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !detailsOverlay.classList.contains("hidden")) {
        closeDetails();
    }
});

tabIncludedEl.addEventListener("click", () => setActiveTab("included"));
tabSkippedEl.addEventListener("click", () => setActiveTab("skipped"));
detailsSearchEl.addEventListener("input", renderDetailsList);

detailsCopyEl.addEventListener("click", async () => {
    if (!lastBundleMeta) return;
    const query = detailsSearchEl.value.trim().toLowerCase();
    const items = activeTab === "included"
        ? lastBundleMeta.files.included.map((path) => ({ path }))
        : lastBundleMeta.files.skipped;
    const filtered = query
        ? items.filter((item) => item.path.toLowerCase().includes(query))
        : items;

    const text = filtered
        .map((item) => (item.reason ? `${item.path} — ${item.reason} ` : item.path))
        .join("\n");
    if (text) {
        await window.api.copyToClipboard(text);
        toast("Copied list");
    }
});
