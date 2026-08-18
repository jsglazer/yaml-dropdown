# YAML Dropdown

[![GitHub release](https://img.shields.io/github/v/release/jsglazer/yaml-dropdown?logo=github)](https://github.com/jsglazer/yaml-dropdown/releases) [![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/jsglazer/yaml-dropdown/blob/main/LICENSE) [![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97756?logo=anthropic)](https://claude.ai) [![Gemini Flash Antigravity](https://img.shields.io/badge/Gemini%20Flash-Antigravity-4f86f7?logo=google-gemini&logoColor=white)](https://github.com/google-gemini) [![CI](https://github.com/jsglazer/yaml-dropdown/actions/workflows/ci.yml/badge.svg)](https://github.com/jsglazer/yaml-dropdown/actions/workflows/ci.yml)

An Obsidian plugin that offers a dropdown of predefined values after the colon in a frontmatter key, so metadata stays standardised instead of drifting into `Open` / `open` / `Opened`.

## What it does

Put the cursor one space after a frontmatter key's colon and a suggestion list appears:

```yaml
---
Status: |          ← cursor here → Open · In progress · Done
DropdownClass: Book
---
```

The list appears both while you type and when you simply move the cursor into an existing value with the arrow keys or a click. Picking a value replaces the whole value, verbatim.

## Scoping

A rule is never global — every rule carries exactly one scope, and the highest-priority matching rule supplies the complete value list for that key:

| Priority | Scope | Matches against |
|---|---|---|
| 1 (highest) | **File** | The exact vault-relative file path |
| 2 | **DropdownClass** | The note's `DropdownClass` frontmatter value, exactly |
| 3 | **Folder** | A regular expression over the vault-relative parent folder |

Precedence is winner-takes-all: value lists are **never merged** across scopes. If a file-scoped rule matches, its list is the whole list. Within a single scope, the first matching rule in the settings list wins — so drag rules into the order you want with the ↑ ↓ buttons.

### Folder patterns

Folder patterns are JavaScript regular expressions tested against the *parent folder*, using `/` separators with no leading or trailing slash. The vault root is the empty string.

| Pattern | Matches |
|---|---|
| `^Projects` | `Projects`, `Projects/Alpha`, `ProjectsArchive` |
| `^Projects(/\|$)` | `Projects`, `Projects/Alpha` — but not `ProjectsArchive` |
| `^$` | The vault root only |
| `Classes/.*/.*/HW$` | `Classes/2026-B/Econ - PUBP 720/HW` — any two folder levels between `Classes` and a trailing `HW` |
| `HW$` | Any folder whose path ends in `HW`, at any depth |
| *(empty)* | Every folder |

An invalid pattern is reported inline under the field and the rule is skipped. It never throws and never breaks the settings tab.

> **`*` is not a wildcard.** In regex, `*` means "zero or more of the character right before it," not "any characters." `Classes/*/*/HW/` will *not* match `Classes/2026-B/Econ - PUBP 720/HW` — use `.*` (any characters) instead of a bare `*`, and remember the folder path has no trailing slash to match against.

### DropdownClass

Add a `DropdownClass` key to a note's frontmatter to opt it into class-scoped rules:

```yaml
---
DropdownClass: Book
Status: Reading
---
```

`DropdownClass` is a fixed key name and is read as a single scalar string. YAML arrays, inline lists, and unquoted comma-separated values are ignored in v1 — quote the value if it genuinely contains a comma.

## Settings

Each rule has:

- **Frontmatter key** — the key it supplies values for, e.g. `Status`
- **Values** — comma-separated; blanks are dropped and duplicates removed
- **Scope** — Folder, DropdownClass, or File
- **Pattern** — the regex or exact literal for that scope
- **Enable toggle**, plus ↑ ↓ reorder and delete

One global option, **Case-insensitive keys**, controls frontmatter *key* matching only. Suggestion filtering is always case-insensitive; folder, file, and `DropdownClass` matching are always case-sensitive.

## Behaviour details

These are deliberate, and each is covered by a test:

- **Spacing is exact.** The dropdown appears only after a colon followed by *exactly one* space. Zero spaces or two or more do nothing, and the plugin never inserts a space for you.
- **Filtering is substring, not fuzzy.** Matches keep the order you defined them in — never sorted, never ranked. An empty value shows the full list.
- **Accepting replaces the whole value.** From the value-start offset to end of line, inserted verbatim: no quoting, escaping, type coercion, or YAML validation. No other line is touched.
- **Frontmatter must be well-formed.** An opening `---` on line 1 with nothing before it, and a closing `---` or `...` within the first 100 lines. Otherwise nothing triggers.

## Install

### From release

Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/jsglazer/yaml-dropdown/releases) into `<vault>/.obsidian/plugins/yaml-dropdown/`, then enable the plugin in **Settings → Community plugins**.

### From source

```bash
git clone https://github.com/jsglazer/yaml-dropdown.git
cd yaml-dropdown
npm install
npm run build
```

## Development

```bash
npm run dev     # esbuild watch
npm test        # vitest, headless
npm run build   # tsc --noEmit + production bundle
```

### Architecture

All decision logic lives in dependency-free modules under `src/core/` — they take line strings, cursor offsets, and vault-relative paths, and return plain data. They import nothing from `obsidian`, touch no DOM, and perform no I/O, so the test suite runs fully headless with no mocking.

```
src/
  main.ts               Plugin subclass and wiring
  suggest.ts            EditorSuggest subclass — unwraps Obsidian objects at the boundary
  cursor-trigger.ts     The single CM6 updateListener that drives cursor-move suggestions
  settingsTab.ts        Settings UI
  scheduler.ts          Platform timer, injected into the debouncer
  adapters/
    suggest-trigger.ts  The ONLY file touching an undocumented Obsidian internal
  core/                 Pure, synchronous decision logic
```

Auto-triggering uses exactly one mechanism — a CodeMirror 6 `EditorView.updateListener` registered through `registerEditorExtension`. There is no `selectionchange` listener, no global keydown handler, and no MutationObserver, so iOS soft-keyboard input flows through the same path as everything else.

Forcing the suggestion popup open on a cursor move needs one undocumented internal, `app.workspace.editorSuggest.trigger(editor, file, force)`, verified against Obsidian 1.13.7. It is confined to `src/adapters/suggest-trigger.ts` and guarded by a runtime `typeof` check: if it ever disappears, the plugin silently falls back to typing-triggered suggestions and a future API break is a one-file fix. `tests/purity.test.ts` enforces that confinement mechanically.

Mobile is supported: `isDesktopOnly` is `false` and no Node, Electron, `fs`, `path`, `process`, or `require` API appears anywhere in the source.

## License

[MIT](LICENSE)
