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

const SHOW_DELAY_MS = 900;
const FADE_MS = 250;

let mode = null; // "folder" | "files"
let folderPath = null;
let filePaths = null;
let lastBundleMeta = null;
let lastTotalLabel = "Total";
let activeTab = "included";

const toastEl = document.getElementById("toast");
let toastTimer = null;
let scrollTimer = null;

outputEl.style.setProperty("--scroll-fade", `${FADE_MS}ms`);
statsEl.classList.add("stats");
renderStats(null);

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
        statsEl.innerHTML = `<span class="statsPlaceholder">—</span>`;
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

document.getElementById("pickFolder").addEventListener("click", async () => {
    const picked = await window.api.pickFolder();
    if (!picked) return;
    mode = "folder";
    folderPath = picked;
    filePaths = null;
    targetEl.textContent = `Folder: ${picked} `;
    lastBundleMeta = null;
    lastTotalLabel = "Total scanned";
    renderStats(null);
});

document.getElementById("pickFiles").addEventListener("click", async () => {
    const picked = await window.api.pickFiles();
    if (!picked) return;
    mode = "files";
    filePaths = picked;
    folderPath = null;
    targetEl.textContent = `Files: ${picked.length} selected`;
    lastBundleMeta = null;
    lastTotalLabel = "Total";
    renderStats(null);
});

document.getElementById("bundle").addEventListener("click", async () => {
    const options = { useBasenameOnly: basenameOnlyEl.checked };

    if (mode === "folder" && folderPath) {
        const res = await window.api.bundleFolder(folderPath, options);
        outputEl.value = res.output;
        lastBundleMeta = res;
        lastTotalLabel = "Total scanned";
        renderStats(res.stats);
        toast("Bundled");
        return;
    }

    if (mode === "files" && filePaths?.length) {
        const res = await window.api.bundleFiles(filePaths, options);
        outputEl.value = res.output;
        lastBundleMeta = res;
        lastTotalLabel = "Total";
        renderStats(res.stats);
        toast("Bundled");
        return;
    }

    alert("Pick a folder or files, then click Bundle.");
});

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
