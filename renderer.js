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
const selectionViewEl = document.getElementById("selectionView");
const viewSelectionBtn = document.getElementById("viewSelection");
const viewOutputBtn = document.getElementById("viewOutput");

const SHOW_DELAY_MS = 900;
const FADE_MS = 250;

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

const toastEl = document.getElementById("toast");
let toastTimer = null;
let scrollTimer = null;

outputEl.style.setProperty("--scroll-fade", `${FADE_MS}ms`);
statsEl.classList.add("stats");
renderStats(null);
targetEl.textContent = buildTargetLabel();
renderSelection();
setView("selection");

statsEl.addEventListener("click", (event) => {
    if (!statsEl.dataset.hasDetails) return;
    if (event.target.closest("button")) return;
    openDetails();
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
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1200);
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

function pruneExcludedPaths() {
    if (selectionEntries.length === 0) {
        excludedAbsPaths.clear();
        return;
    }

    const selectedRoots = selectionEntries
        .filter((entry) => entry.kind === "folder")
        .map((entry) => entry.absPath);

    for (const excludedPath of Array.from(excludedAbsPaths)) {
        const keep = selectedRoots.some((rootPath) => isSameOrDescendantPath(excludedPath, rootPath));
        if (!keep) excludedAbsPaths.delete(excludedPath);
    }
}

async function refreshSelectionHierarchy() {
    const token = ++hierarchyToken;

    if (selectionEntries.length === 0) {
        selectionHierarchy = [];
        knownFolderPaths.clear();
        collapsedFolders.clear();
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
        selectionEntries = selectionEntries.filter((entry) => {
            if (entry.kind !== "folder") return true;
            return visibleRootPaths.has(entry.absPath);
        });
        if (selectionEntries.length !== beforeCount) {
            targetEl.textContent = buildTargetLabel();
        }
        const selectedFolderRoots = new Set(
            selectionEntries
                .filter((entry) => entry.kind === "folder")
                .map((entry) => entry.absPath)
        );
        syncFolderCollapseDefaults(selectionHierarchy, selectedFolderRoots);
        renderSelection();
    } catch (error) {
        console.error("Failed to load selection hierarchy", error);
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

async function addEntries(newEntries) {
    const next = new Map(selectionEntries.map((entry) => [`${entry.kind}:${entry.absPath}`, entry]));
    for (const entry of newEntries) {
        next.set(`${entry.kind}:${entry.absPath}`, entry);
        excludedAbsPaths.delete(entry.absPath);
    }
    selectionEntries = Array.from(next.values());
    pruneExcludedPaths();
    lastBundleMeta = null;
    outputEl.value = "";
    targetEl.textContent = buildTargetLabel();
    renderStats(null);
    await refreshSelectionHierarchy();
    await rebundleSelectionLive();
}

function resetSelectionState() {
    selectionEntries = [];
    selectionHierarchy = [];
    excludedAbsPaths.clear();
    collapsedFolders.clear();
    knownFolderPaths.clear();
    lastBundleMeta = null;
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

async function rebundleSelectionLive() {
    const token = ++rebundleToken;

    if (selectionEntries.length === 0) {
        outputEl.value = "";
        lastBundleMeta = null;
        lastTotalLabel = "Total";
        renderStats(null);
        setView("selection");
        return;
    }

    try {
        const options = {
            useBasenameOnly: basenameOnlyEl.checked,
            excludedPaths: Array.from(excludedAbsPaths),
        };
        const res = await window.api.bundleSelection(selectionEntries, options);
        if (token !== rebundleToken) return;

        outputEl.value = res.output;
        lastBundleMeta = res;
        lastTotalLabel = "Total";
        renderStats(res.stats);
    } catch (error) {
        console.error("Live rebundle failed", error);
    }
}

function renderSelection() {
    const counts = { folders: 0, files: 0 };

    const countNodes = (node) => {
        if (node.kind === "folder") counts.folders += 1;
        if (node.kind === "file") counts.files += 1;
        for (const child of node.children ?? []) countNodes(child);
    };

    for (const node of selectionHierarchy) countNodes(node);
    const total = counts.folders + counts.files;

    selectionSummaryEl.textContent = `Bundled tree: ${total} items (folders ${counts.folders}, files ${counts.files})`;

    selectionListEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    const renderNode = (node, depth, ancestorExcluded = false) => {
        const isFolder = node.kind === "folder";
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

        const removeBtn = document.createElement("button");
        removeBtn.className = "selectionRemove";
        removeBtn.type = "button";
        removeBtn.dataset.path = node.absPath;
        removeBtn.dataset.kind = node.kind;
        removeBtn.dataset.action = "remove";

        if (directExcluded) {
            removeBtn.textContent = "Add";
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
        row.appendChild(name);
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

    for (const node of selectionHierarchy) {
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

function openDetails() {
    if (!lastBundleMeta) return;
    detailsOverlay.classList.remove("hidden");
    detailsOverlay.setAttribute("aria-hidden", "false");
    setActiveTab(activeTab || "included");
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

document.getElementById("pickEntries").addEventListener("click", async () => {
    const picked = await window.api.pickEntries();
    if (!picked || picked.length === 0) return;

    const entries = await Promise.all(
        picked.map(async (absPath) => {
            const stat = await window.api.statPath(absPath);
            if (stat?.isDirectory) return { kind: "folder", absPath };
            if (stat?.isFile) return { kind: "file", absPath };
            return null;
        })
    );

    const validEntries = entries.filter(Boolean);
    if (validEntries.length === 0) return;

    resetSelectionState();
    lastTotalLabel = "Total";
    await addEntries(validEntries);
});

basenameOnlyEl.addEventListener("change", async () => {
    if (selectionEntries.length === 0) return;
    await rebundleSelectionLive();
});

selectionListEl.addEventListener("click", (event) => {
    const toggle = event.target.closest(".selectionTreeToggle");
    if (toggle?.dataset.path) {
        void animateFolderToggle(toggle.dataset.path);
        return;
    }

    const button = event.target.closest(".selectionRemove");
    if (!button) return;
    if (button.disabled) return;
    const action = button.dataset.action;
    if (action === "add") {
        void toggleEntryBundled(button.dataset.path, true);
        return;
    }
    void toggleEntryBundled(button.dataset.path, false);
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

    const entries = await Promise.all(
        files.map(async (file) => {
            const absPath = file.path;
            const stat = await window.api.statPath(absPath);
            if (stat?.isDirectory) return { kind: "folder", absPath };
            if (stat?.isFile) return { kind: "file", absPath };
            return null;
        })
    );

    void addEntries(entries.filter(Boolean));
});

// Bundling is live; no manual bundle action is required.

document.getElementById("copy").addEventListener("click", async () => {
    await window.api.copyToClipboard(outputEl.value);
    toast("Copied to clipboard");
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
