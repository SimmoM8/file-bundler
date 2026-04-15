

# File Bundler

Bundle your entire codebase into a clean AI-ready prompt in seconds.

Built for developers working with AI-assisted workflows:
- ChatGPT / Claude workflows
- Code reviews
- Sharing projects with teammates
- Debugging and handoffs

Current version: **0.3.0**

## Demo

![Demo](./file-bundler-demo.gif)

## Key Features

- Bundle entire folders and files into one structured, copyable output
- Smart filtering (automatically ignores binaries, large and irrelevant files, .gitignore, etc.)
- Visually see the files and folders selected for bundling in a nested file tree
- Easily remove or re-add files to the bundle
- See which files were included or skipped from the selection
- One-click copy to clipboard
- Clean, readable output designed for AI tools

## Why File Bundler?

Often the AI struggles to interpret uploaded files, leading to incomplete or incorrect results. A common workaround is manually copy-pasting files into prompts — but this is **painfully slow**, messy, and error-prone.

File Bundler solves this by letting you select your project and instantly generate a clean, structured prompt — ready to paste into ChatGPT or share with others.

## How to Use

1. Click `Select content` to choose files/folders.
2. Review the selection tree and output (bundling runs automatically).
3. Use `Remove` or `Re-add` to control which files are bundled.
4. Optionally toggle `Base names` for shorter or full directory path as file names in the output.
5. Click `Copy` to copy the full bundled output.

## Output Format

```
path/to/file.ext:
<file contents>

---

path/to/other_file.ext:
<file contents>
```

## Download

Download the latest version from the **Releases** page:

👉 **[Download File Bundler](../../releases)**

- **macOS** — `.dmg`
- **Windows** — `.exe`

No setup required — just install and run.

***macOS note**: the app is unsigned. If blocked by* Gatekeeper:

1. Try opening the app once.
2. Open `System Settings -> Privacy & Security`.
3. Scroll to the security warning for File Bundler.
4. Click `Open Anyway`.

## Development

Requirements:

- Node.js (LTS)
- npm

Install dependencies and run the app in development mode:

```bash
npm install
npm start
```

## Build / Package

This app is packaged using `electron-builder`.

To create installers locally:

```bash
npm run dist
```

Artifacts are created in `dist/` and distributed via GitHub Releases.

## License

MIT. See [LICENSE](LICENSE).