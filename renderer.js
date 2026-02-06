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

document.getElementById("pickFolder").addEventListener("click", async () => {
    const picked = await window.api.pickFolder();
    if (!picked) return;
    mode = "folder";
    folderPath = picked;
    filePaths = null;
    targetEl.textContent = `Folder: ${picked}`;
    statsEl.textContent = "";
});

document.getElementById("pickFiles").addEventListener("click", async () => {
    const picked = await window.api.pickFiles();
    if (!picked) return;
    mode = "files";
    filePaths = picked;
    folderPath = null;
    targetEl.textContent = `Files: ${picked.length} selected`;
    statsEl.textContent = "";
});

document.getElementById("bundle").addEventListener("click", async () => {
    const options = { useBasenameOnly: basenameOnlyEl.checked };

    if (mode === "folder" && folderPath) {
        const res = await window.api.bundleFolder(folderPath, options);
        outputEl.value = res.output;
        statsEl.textContent = `Included: ${res.stats.included} | Skipped: ${res.stats.skipped} | Total scanned: ${res.stats.total}`;
        toast("Bundled");
        return;
    }

    if (mode === "files" && filePaths?.length) {
        const res = await window.api.bundleFiles(filePaths, options);
        outputEl.value = res.output;
        statsEl.textContent = `Included: ${res.stats.included} | Skipped: ${res.stats.skipped} | Total: ${res.stats.total}`;
        toast("Bundled");
        return;
    }

    alert("Pick a folder or files, then click Bundle.");
});

document.getElementById("copy").addEventListener("click", async () => {
    await window.api.copyToClipboard(outputEl.value);
    toast("Copied to clipboard");
});
