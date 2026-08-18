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
