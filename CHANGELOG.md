# Changelog

All notable changes to this project will be documented in this file.

The format is based on **Keep a Changelog** and this project adheres to **Semantic Versioning**.

## [Unreleased]
### Added
### Changed
### Fixed

## [0.3.3] - 2026-08-18
### Added
- External-change monitoring now detects selected files modified after the last bundle, marks affected rows as `Changed`, updates the bundle status, and recommends rebundling.
- A manual `Rebundle` action refreshes the current selection from disk without requiring it to be selected again.
- Output diagnostics now show character, line, and kilobyte totals, plus an estimated token count in the size-details dialog.
- Outputs estimated above 100,000 tokens now display a clickable LLM context-size warning with additional guidance.
- Selection tree rows now show character, line, and byte-size previews for files and aggregated totals for folders.
- The README now includes an animated product demo.

### Changed
- Bundled output now wraps each file's contents in a fenced code block and separates file sections with `---` dividers.
- Selection actions were reorganized into grouped `Add content` / `Rebundle` controls and a visually separated destructive `Clear` action.
- Bundle status and output diagnostics received clearer warning states, responsive layout updates, and accessible labels and dialog focus handling.
- File preview metadata is cached by modification time and file size so unchanged files are not reread during selection refreshes.
- README content, feature documentation, usage instructions, and version references were expanded for the current release.

### Fixed
- Fixed packaged app builds to include runtime dependencies from `node_modules`, resolving startup failures such as missing `ignore` in production releases.
- Unavailable preview metadata now remains absent instead of displaying misleading zero values.
- Empty selection action groups are now hidden when no content is selected.

## [0.3.0] - 2026-04-15
### Added
- Mixed content selection flow that supports choosing files and folders together in one picker.
- Selection management actions in-panel, including `Add content` and `Clear selection`.
- Recursive selection tree with grouped folder display, folder toggles, partial flags, and drag-and-drop add support.
- Removal model that keeps excluded entries visible with `Remove` / `Re-add` controls and clear excluded-state visuals.
- Confirmation dialogs for destructive selection actions, including optional `Don't ask me again` for replace-selection prompts.
- Expanded toast feedback system with success/error messaging across core user actions.
- App metadata display in the UI footer with runtime version and copyright information.
- New IPC APIs to support git-root discovery and app metadata retrieval (`findGitRoot`, `getAppInfo`).

### Changed
- Bundling is now fully live: selection changes and basename toggle updates rebundle output automatically.
- Selection workflow was simplified from separate pick modes to a unified `Select content` experience.
- Stats presentation was refined for stronger contrast and readability, including improved hover detail panel styling.
- Background/theme palette received a refresh while keeping the app's glass styling language consistent.
- Selection list spacing, control layout, and action button styling were tuned for better clarity and visual balance.
- README was rewritten to reflect the current 0.3.0 workflow, features, and usage.

### Fixed
- Improved `.gitignore` handling by enhancing matcher lookup behavior across ancestor paths.
- Corrected selection hierarchy and bundling exclusion behavior so excluded paths and skipped entries are handled consistently.
- Fixed grouping logic to respect repository boundaries and avoid over-grouping beyond the effective project root.
- Resolved collapse-state regressions so manual folder expansion remains stable after auto-focus expansion flows.
- Fixed stats hover/popup layering and transparency issues so overlays render above panel content reliably.

## [0.2.0] - 2026-02-07
### Added
- Complete glass UI redesign across the app (top bar, panel, editor, buttons, toggles).
- Toast notifications and refined visual feedback for actions.
- Glassy stats chips with hover previews for included/skipped files.
- Bundle details modal with segmented tabs, search/filter, copy list, and keyboard/overlay close.
- Included/skipped file metadata with reasons for skipped items.
- Release automation workflow and publish configuration.

### Changed
- Layout spacing, typography, and component density for the new design system.
- Scrollbar styling and scroll behavior throughout the UI.
- Copy/alert/placeholder messaging for clarity.
- Modal sizing and list layout to keep a consistent height with clean truncation.
- Editor styling, focus rings, and empty-state presentation.

### Fixed
- Details list overflow and long-path clipping in the bundle details view.

## [0.1.1] - 2026-02-07
### Added
- Initial release:
  - Pick Folder / Pick Files
  - Bundle output preview
  - Copy to clipboard
  - Basic ignore rules and binary detection
