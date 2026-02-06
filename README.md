

# File Bundler

File Bundler is a small desktop app that bundles the contents of a folder or selected files into one copyable block of text.

The output format looks like this:

```
path/to/file.ext:
<file contents>

--

path/to/other_file.ext:
<file contents>
```

It’s designed for sharing project context with ChatGPT, code reviews, documentation, or archiving.

---

## Download

Go to the **Releases** page on GitHub and download the installer for your operating system:

- **macOS** — `.dmg`
- **Windows** — `.exe`

No terminal or Node.js required to use the app once installed.

---

## Features

- Select a **folder** or **multiple files**
- Output preview before copying
- One‑click **Copy to Clipboard**
- Option to use **base file names** or **relative paths**
- Skips common junk folders (`.git`, `node_modules`, `dist`, etc.)
- Skips obvious binary files (images, archives, media, fonts)
- Safety limits to avoid freezing on very large projects

---

## How to Use

1. Open File Bundler
2. Click **Pick Folder** or **Pick Files**
3. Click **Bundle**
4. Review the output
5. Click **Copy** and paste wherever you need it

---

## Development

Requirements:
- Node.js (LTS)
- npm

Install dependencies and run the app in development mode:

```bash
npm install
npm start
```

---

## Build / Package

This app is packaged using `electron-builder`.

To create installers locally:

```bash
npm run dist
```

Build artifacts will be created in the `dist/` directory.  
These files are **not committed** to the repository and are distributed via GitHub Releases.

---

## Roadmap

- Configurable ignore rules
- Adjustable file size limits
- Progress indicator for large projects
- VS Code extension built on top of the same bundling core

---

## License

MIT — see the [LICENSE](LICENSE) file for details.