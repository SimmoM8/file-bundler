

# File Bundler

File Bundler is a desktop app that combines selected files and folders into one copyable text block for AI prompts, code reviews, handoffs, and archiving.

Current version: **0.3.0**

## Output Format

```
path/to/file.ext:
<file contents>

--

path/to/other_file.ext:
<file contents>
```

## Download

Go to the **Releases** page on GitHub and download the installer for your operating system:

- **macOS** — `.dmg`
- **Windows** — `.exe`

No Node.js or terminal is needed once installed.

macOS note: the app is unsigned. If blocked by Gatekeeper:

1. Try opening the app once.
2. Open `System Settings -> Privacy & Security`.
3. Scroll to the security warning for File Bundler.
4. Click `Open Anyway`.

## Key Features

- Mixed content picking (files and folders together)
- Live rebundling (no manual Bundle button)
- Selection tree with nested folders and grouped views
- Remove/Re-add controls that keep excluded items visible
- Auto-collapse and focus behavior when adding content
- `Select content`, `Add content`, and `Clear selection` actions
- Confirmation dialogs for replace/clear actions
- Optional `Don't ask me again` for replace-selection prompt
- Toast feedback for success/error across core user actions
- Stats chips with hover previews and details modal (Included/Skipped)
- `Base names` toggle with live rebundle
- Copy output and copy details list actions
- Filtering/skip rules for ignored folders, binary/large files, dotfiles, and `.gitignore`

## How to Use

1. Click `Select content` to choose files/folders.
2. Review the selection tree and output (bundling runs automatically).
3. Use `Remove` or `Re-add` to control which files are bundled.
4. Optionally toggle `Base names` for shorter or full directory path as file names in the output.
5. Click `Copy` to copy the full bundled output.

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