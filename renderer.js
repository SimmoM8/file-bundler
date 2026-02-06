const targetEl = document.getElementById("target");
const statsEl = document.getElementById("stats");
const outputEl = document.getElementById("output");
const basenameOnlyEl = document.getElementById("basenameOnly");

let mode = null; // "folder" | "files"
let folderPath = null;
let filePaths = null;

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
        return;
    }

    if (mode === "files" && filePaths?.length) {
        const res = await window.api.bundleFiles(filePaths, options);
        outputEl.value = res.output;
        statsEl.textContent = `Included: ${res.stats.included} | Skipped: ${res.stats.skipped} | Total: ${res.stats.total}`;
        return;
    }

    alert("Pick a folder or files first.");
});

document.getElementById("copy").addEventListener("click", async () => {
    await window.api.copyToClipboard(outputEl.value);
    statsEl.textContent = (statsEl.textContent ? statsEl.textContent + " | " : "") + "Copied!";
});