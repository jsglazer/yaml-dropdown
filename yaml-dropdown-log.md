# yaml-dropdown — Dev Log

(Note: this file exists because the project CLAUDE.md forbids writing to `yaml-dropdown Dev.md`, and no `UpdateNNN.md` was open. Per the parent Dev CLAUDE.md fallback, session logs go here instead.)

## 2026-08-18 — README: folder pattern examples

**Context:** User's `Status` dropdown wasn't appearing for a note under `Classes/2026-B/Econ - PUBP 720/HW/`. Root cause: their Folder-scope pattern `Classes/*/*/HW/` used glob-style `*` in a field that's actually a JS regex — `*` means "zero or more of the preceding character," not "any characters," and the matched folder path also has no trailing slash. Diagnosed via `src/core/scope.ts` (`compileFolderPattern` + `scopeMatches`, unanchored `RegExp.test`) and `src/core/paths.ts` (`parentFolderPath` strips the trailing slash). Fix given to user: `Classes/.*/.*/HW$` (or simply `HW$`). Confirmed working.

**Follow-up:** User asked to add examples to the README so this doesn't trip up others.

### Changes
- `README.md` — "Folder patterns" table: added two example rows (`Classes/.*/.*/HW$`, `HW$`) and a callout note clarifying that a bare `*` is not a wildcard in regex — use `.*`, and that the matched folder path has no trailing slash.

### Commit
- `2144bc2` — "docs: add multi-segment folder pattern examples and *-vs-.* note to README" — pushed to `main`.

## Session summary (verbatim, as presented to user)

Added two example rows to the "Folder patterns" table in `README.md`:
- `Classes/.*/.*/HW$` → matches `Classes/2026-B/Econ - PUBP 720/HW`
- `HW$` → matches any folder ending in `HW`

Plus a callout explaining that `*` alone isn't a wildcard in regex (it repeats the preceding character) — use `.*` instead — and that the matched folder path has no trailing slash. Committed and pushed as `2144bc2`.

## 2026-08-24 — Dropdown not appearing for `Status` in POGO 511 HW note; root cause was an external plugin conflict, not yaml-dropdown

**Context:** User's `Status` dropdown wasn't appearing for `Classes/2026-B/Data - POGO 511/HW/HW01-260823.md`. Investigation went through several rounds:

1. Found the deployed rule's folder pattern (`^Classes/[^/]+/[^/]+/[^/]+/[^/]+\.md$` in `VaultSchar/.obsidian/plugins/yaml-dropdown/data.json`) was written as if matching the full file path, but `scopeMatches`/`parentFolderPath` (`src/core/scope.ts`, `src/core/paths.ts`) test folder-scope patterns against the *parent folder only* — no filename, no `.md`, no trailing slash. A trailing `\.md$` can never match a folder path. User corrected it to `^Classes/[^/]+/[^/]+/HW$`, confirmed against the actual folder (`Classes/2026-B/Data - POGO 511/HW`) — still didn't work.
2. Ruled out stale in-memory settings (plugin reload + full Obsidian restart didn't help) and ruled out `main.js` drift from `src/` (deployed bundle matches source exactly, `git status` clean).
3. Ruled out Obsidian's visual Properties panel intercepting the field — user confirmed they were editing raw YAML text, not the Properties UI.
4. Checked byte-level content of the `Status:` line (`od -c`) to rule out a missing/extra trailing space breaking `detectTriggerPosition`'s exact-one-space rule — content was correct.
5. Checked `obsidian-linter`'s `data.json` for `lintOnSave` (stripping trailing whitespace would silently break the exact-one-space trigger) — `lintOnSave: false`, ruled out.
6. Found **Metadata Menu** (`metadata-menu` plugin, enabled, `isAutosuggestEnabled: true` in its `data.json`) registers a generic frontmatter-field `EditorSuggest` that doesn't require explicit field config. Obsidian's `EditorSuggestManager` asks registered suggesters in order and stops at the first one whose `trigger()` returns true (documented in yaml-dropdown's own `src/adapters/suggest-trigger.ts`). `metadata-menu` is listed ahead of `yaml-dropdown` in `community-plugins.json`, so it was very likely claiming the `Status:` trigger before yaml-dropdown ever saw it.

**Fix confirmed:** Disabling Metadata Menu's autosuggest (or the plugin) let yaml-dropdown's dropdown appear. **User confirmed this fixed it.**

**No code or repo changes this session** — root cause was outside the plugin (a suggest-registration-order conflict with another installed plugin), not a yaml-dropdown bug. No commit made.

**Open follow-up:** Permanently disabling Metadata Menu's autosuggest is a workaround, not a real fix, if the user relies on Metadata Menu elsewhere. Metadata Menu exposes a `globallyIgnoredFields` setting (empty array currently) that may let specific keys (e.g. `Status`) opt out of its autosuggest without disabling the plugin — untested, offered to the user as a next step but not yet applied (`metadata-menu/data.json` is outside this project's permitted write paths).

## Session summary (verbatim, as presented to user)

Confirmed: disabling Metadata Menu's autosuggest fixed the `Status` dropdown. Root cause was a suggest-registration-order conflict — Metadata Menu's generic frontmatter autosuggest was claiming the `Status:` trigger before yaml-dropdown ever got a chance, regardless of how correct yaml-dropdown's own regex and settings were. No yaml-dropdown code or config issue was actually present by this point (the folder-pattern fix from earlier in the session was a real bug, but not the one blocking this case). No commits made this session.
