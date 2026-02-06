const targetEl = document.getElementById("target");
const statsEl = document.getElementById("stats");
const outputEl = document.getElementById("output");
const basenameOnlyEl = document.getElementById("basenameOnly");

const SHOW_DELAY_MS = 900;
const FADE_MS = 250;

let mode = null; // "folder" | "files"
let folderPath = null;
let filePaths = null;

const toastEl = document.getElementById("toast");
let toastTimer = null;
let scrollTimer = null;

outputEl.style.setProperty("--scroll-fade", `${FADE_MS}ms`);
statsEl.classList.add("stats");
renderStats(null);

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

function renderStats(statsInput) {
    const stats = normalizeStats(statsInput);

    if (!stats) {
        statsEl.innerHTML = '<span class="statsPlaceholder">—</span>';
        return;
    }

    statsEl.innerHTML = `
        <div class="statChip">
            <span class="statLabel">Included</span>
            <span class="statValue">${stats.included}</span>
        </div>
        <div class="statChip">
            <span class="statLabel">Skipped</span>
            <span class="statValue">${stats.skipped}</span>
        </div>
        <div class="statChip">
            <span class="statLabel">Total</span>
            <span class="statValue">${stats.total}</span>
        </div>
    `;
}

document.getElementById("pickFolder").addEventListener("click", async () => {
    const picked = await window.api.pickFolder();
    if (!picked) return;
    mode = "folder";
    folderPath = picked;
    filePaths = null;
    targetEl.textContent = `Folder: ${picked}`;
    renderStats(null);
});

document.getElementById("pickFiles").addEventListener("click", async () => {
    const picked = await window.api.pickFiles();
    if (!picked) return;
    mode = "files";
    filePaths = picked;
    folderPath = null;
    targetEl.textContent = `Files: ${picked.length} selected`;
    renderStats(null);
});

document.getElementById("bundle").addEventListener("click", async () => {
    const options = { useBasenameOnly: basenameOnlyEl.checked };

    if (mode === "folder" && folderPath) {
        const res = await window.api.bundleFolder(folderPath, options);
        outputEl.value = res.output;
        renderStats(res.stats);
        toast("Bundled");
        return;
    }

    if (mode === "files" && filePaths?.length) {
        const res = await window.api.bundleFiles(filePaths, options);
        outputEl.value = res.output;
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
