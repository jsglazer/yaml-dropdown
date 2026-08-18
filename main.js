"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => YamlDropdownPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");
var import_view = require("@codemirror/view");

// src/adapters/suggest-trigger.ts
function forceSuggestTrigger(app, editor, file) {
  const workspace = app.workspace;
  const manager = workspace.editorSuggest;
  if (!manager || typeof manager.trigger !== "function") return false;
  try {
    manager.trigger.call(manager, editor, file, true);
    return true;
  } catch (error) {
    return false;
  }
}

// src/core/debounce.ts
var CURSOR_TRIGGER_DELAY_MS = 40;
function createTrailingDebouncer(scheduler, delayMs) {
  let handle = null;
  return {
    schedule(callback) {
      if (handle !== null) scheduler.clear(handle);
      handle = scheduler.defer(() => {
        handle = null;
        callback();
      }, delayMs);
    },
    cancel() {
      if (handle === null) return;
      scheduler.clear(handle);
      handle = null;
    }
  };
}

// src/core/reentry.ts
function sameSite(a, b) {
  if (a === null || b === null) return false;
  return a.line === b.line && a.valueStart === b.valueStart;
}
function shouldRetrigger(isOpen, openSite, nextSite) {
  if (!isOpen) return true;
  return !sameSite(openSite, nextSite);
}

// src/cursor-trigger.ts
var CursorTrigger = class {
  constructor(app, suggest, scheduler, delayMs = CURSOR_TRIGGER_DELAY_MS) {
    this.app = app;
    this.suggest = suggest;
    this.debouncer = createTrailingDebouncer(scheduler, delayMs);
  }
  handleUpdate(update) {
    if (update.docChanged) return;
    if (!update.selectionSet) return;
    this.debouncer.schedule(() => this.fire());
  }
  /** Cancel any pending trailing callback so it cannot fire into an unloaded plugin. */
  dispose() {
    this.debouncer.cancel();
  }
  fire() {
    const active = this.app.workspace.activeEditor;
    if (!active) return;
    const editor = active.editor;
    const file = active.file;
    if (!editor || file === null) return;
    const resolved = this.suggest.resolve(editor, file, editor.getCursor());
    if (resolved === null) return;
    if (!shouldRetrigger(this.suggest.isPopupOpen(), this.suggest.openSite(), resolved.site)) {
      return;
    }
    forceSuggestTrigger(this.app, editor, file);
  }
};

// src/suggest.ts
var import_obsidian = require("obsidian");

// src/core/frontmatter.ts
var MAX_FRONTMATTER_SCAN_LINES = 100;
var CLASS_KEY = "DropdownClass";
var OPEN_FENCE = "---";
var CLOSE_FENCES = ["---", "..."];
function detectFrontmatter(lines) {
  if (lines.length === 0) return null;
  if (trimEnd(lines[0]) !== OPEN_FENCE) return null;
  const limit = Math.min(lines.length, MAX_FRONTMATTER_SCAN_LINES);
  for (let i = 1; i < limit; i++) {
    if (CLOSE_FENCES.indexOf(trimEnd(lines[i])) !== -1) {
      return { startLine: 0, endLine: i };
    }
  }
  return null;
}
function isInsideFrontmatter(range, line) {
  return line > range.startLine && line < range.endLine;
}
function parseDropdownClass(lines, range) {
  for (let i = range.startLine + 1; i < range.endLine; i++) {
    const line = lines[i];
    if (line.slice(0, CLASS_KEY.length) !== CLASS_KEY) continue;
    if (line.charAt(CLASS_KEY.length) !== ":") continue;
    return parseScalar(line.slice(CLASS_KEY.length + 1));
  }
  return null;
}
function parseScalar(raw) {
  const value = raw.trim();
  if (value.length === 0) return null;
  if (value.charAt(0) === "[" || value.charAt(0) === "-") return null;
  const unquoted = stripQuotes(value);
  if (unquoted !== value) return unquoted;
  if (value.indexOf(",") !== -1) return null;
  return value;
}
function stripQuotes(value) {
  if (value.length < 2) return value;
  const first = value.charAt(0);
  if (first !== '"' && first !== "'") return value;
  if (value.charAt(value.length - 1) !== first) return value;
  return value.slice(1, value.length - 1);
}
function trimEnd(value) {
  return value.replace(/\s+$/, "");
}

// src/core/edit.ts
function buildReplacement(line, valueStart, value) {
  const from = Math.min(Math.max(valueStart, 0), line.length);
  return { from, to: line.length, text: value };
}

// src/core/filter.ts
function filterValues(values, query) {
  if (query.length === 0) return values.slice();
  const needle = query.toLowerCase();
  return values.filter((value) => value.toLowerCase().indexOf(needle) !== -1);
}

// src/core/paths.ts
function parentFolderPath(filePath) {
  const cut = filePath.lastIndexOf("/");
  return cut === -1 ? "" : filePath.slice(0, cut);
}

// src/core/scope.ts
function compileFolderPattern(pattern) {
  try {
    return { ok: true, regex: new RegExp(pattern) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
function scopeMatches(scope, target) {
  switch (scope.type) {
    case "file":
      return scope.pattern === target.filePath;
    case "class":
      return target.className !== null && scope.pattern === target.className;
    case "folder": {
      const compiled = compileFolderPattern(scope.pattern);
      return compiled.ok ? compiled.regex.test(target.folderPath) : false;
    }
  }
}

// src/core/match.ts
var TIER_ORDER = ["file", "class", "folder"];
function resolveRule(rules, context) {
  for (const tier of TIER_ORDER) {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (rule.scope.type !== tier) continue;
      if (!keyMatches(rule.key, context.key, context.caseInsensitiveKeys)) continue;
      if (!scopeMatches(rule.scope, context)) continue;
      return rule;
    }
  }
  return null;
}
function keyMatches(ruleKey, documentKey, caseInsensitive) {
  if (!caseInsensitive) return ruleKey === documentKey;
  return ruleKey.toLowerCase() === documentKey.toLowerCase();
}

// src/core/trigger.ts
function detectTriggerPosition(line, cursorCh) {
  const colon = line.indexOf(":");
  if (colon <= 0) return null;
  const key = line.slice(0, colon);
  if (!isFrontmatterKey(key)) return null;
  if (line.charAt(colon + 1) !== " ") return null;
  if (line.charAt(colon + 2) === " ") return null;
  const valueStart = colon + 2;
  if (cursorCh < valueStart || cursorCh > line.length) return null;
  return { key, valueStart, query: line.slice(valueStart, cursorCh) };
}
function isFrontmatterKey(key) {
  if (key.length === 0) return false;
  if (key !== key.trim()) return false;
  const first = key.charAt(0);
  return first !== "-" && first !== "#";
}

// src/suggest.ts
var DropdownSuggest = class extends import_obsidian.EditorSuggest {
  constructor(app, getSettings) {
    super(app);
    this.popupOpen = false;
    this.getSettings = getSettings;
  }
  // `open()` and `close()` are documented, overridable members of PopoverSuggest.
  // Tracking the flag here keeps the re-entry guard off `isOpen`, which is not
  // part of the public API.
  open() {
    this.popupOpen = true;
    super.open();
  }
  close() {
    this.popupOpen = false;
    super.close();
  }
  isPopupOpen() {
    return this.popupOpen;
  }
  /** The site the popup is currently open for, from the public `context`. */
  openSite() {
    const context = this.context;
    if (context === null) return null;
    return { line: context.start.line, valueStart: context.start.ch };
  }
  /**
   * Single source of truth for "is this a dropdown site, and which values apply".
   * Reads nothing but editor text — no file writes, no network, no metadata-cache
   * dependency while the editor has content.
   */
  resolve(editor, file, cursor) {
    if (file === null) return null;
    if (cursor.line === 0) return null;
    const match = detectTriggerPosition(editor.getLine(cursor.line), cursor.ch);
    if (match === null) return null;
    const lines = readHeadLines(editor, MAX_FRONTMATTER_SCAN_LINES);
    const range = detectFrontmatter(lines);
    if (range === null) return null;
    if (!isInsideFrontmatter(range, cursor.line)) return null;
    const settings = this.getSettings();
    const rule = resolveRule(settings.rules, {
      key: match.key,
      filePath: file.path,
      folderPath: parentFolderPath(file.path),
      className: this.readDropdownClass(lines, range, file),
      caseInsensitiveKeys: settings.caseInsensitiveKeys
    });
    if (rule === null) return null;
    return {
      site: { line: cursor.line, valueStart: match.valueStart },
      query: match.query,
      values: rule.values
    };
  }
  onTrigger(cursor, editor, file) {
    const resolved = this.resolve(editor, file, cursor);
    if (resolved === null) return null;
    return {
      start: { line: resolved.site.line, ch: resolved.site.valueStart },
      end: cursor,
      query: resolved.query
    };
  }
  getSuggestions(context) {
    const resolved = this.resolve(context.editor, context.file, context.end);
    if (resolved === null) return [];
    return filterValues(resolved.values, context.query);
  }
  renderSuggestion(value, el) {
    el.setText(value);
  }
  selectSuggestion(value, _evt) {
    const context = this.context;
    if (context === null) return;
    const editor = context.editor;
    const line = context.start.line;
    const replacement = buildReplacement(editor.getLine(line), context.start.ch, value);
    editor.replaceRange(
      replacement.text,
      { line, ch: replacement.from },
      { line, ch: replacement.to }
    );
    editor.setCursor({ line, ch: replacement.from + replacement.text.length });
    this.close();
  }
  /**
   * Editor text is authoritative. The metadata cache is consulted only when the
   * editor yields no text at all, so nothing here depends on cache timing while
   * the user is typing.
   */
  readDropdownClass(lines, range, file) {
    var _a;
    if (lines.length > 0) return parseDropdownClass(lines, range);
    const frontmatter = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
    const raw = frontmatter === void 0 ? void 0 : frontmatter[CLASS_KEY];
    return typeof raw === "string" ? raw : null;
  }
};
function readHeadLines(editor, maxLines) {
  const count = Math.min(editor.lineCount(), maxLines);
  const lines = [];
  for (let i = 0; i < count; i++) lines.push(editor.getLine(i));
  return lines;
}

// src/settingsTab.ts
var import_obsidian2 = require("obsidian");

// src/core/values.ts
function parseValueList(raw) {
  const seen = [];
  for (const part of raw.split(",")) {
    const value = part.trim();
    if (value.length === 0) continue;
    if (seen.indexOf(value) !== -1) continue;
    seen.push(value);
  }
  return seen;
}
function formatValueList(values) {
  return values.join(", ");
}

// src/core/settings.ts
var SCHEMA_VERSION = 1;
var SCOPE_TYPES = ["folder", "class", "file"];
function defaultSettings() {
  return { schemaVersion: SCHEMA_VERSION, rules: [], caseInsensitiveKeys: false };
}
function normalizeSettings(raw) {
  const settings = defaultSettings();
  if (!isRecord(raw)) return settings;
  if (typeof raw.schemaVersion === "number" && Number.isFinite(raw.schemaVersion)) {
    settings.schemaVersion = raw.schemaVersion;
  }
  if (typeof raw.caseInsensitiveKeys === "boolean") {
    settings.caseInsensitiveKeys = raw.caseInsensitiveKeys;
  }
  if (Array.isArray(raw.rules)) {
    for (const candidate of raw.rules) {
      const rule = normalizeRule(candidate);
      if (rule !== null) settings.rules.push(rule);
    }
  }
  return settings;
}
function normalizeRule(raw) {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;
  if (typeof raw.key !== "string") return null;
  if (!isRecord(raw.scope)) return null;
  const type = raw.scope.type;
  if (typeof type !== "string" || !isScopeType(type)) return null;
  if (typeof raw.scope.pattern !== "string") return null;
  const values = [];
  if (Array.isArray(raw.values)) {
    for (const value of raw.values) {
      if (typeof value === "string") values.push(value);
    }
  }
  return {
    id: raw.id,
    key: raw.key,
    values,
    scope: { type, pattern: raw.scope.pattern },
    enabled: raw.enabled !== false
  };
}
function nextRuleId(existingIds) {
  let highest = 0;
  for (const id of existingIds) {
    const match = /^rule-(\d+)$/.exec(id);
    if (match === null) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > highest) highest = n;
  }
  return `rule-${highest + 1}`;
}
function newRule(existingIds) {
  return {
    id: nextRuleId(existingIds),
    key: "",
    values: [],
    scope: { type: "folder", pattern: "" },
    enabled: true
  };
}
function moveRule(rules, index, offset) {
  const next = rules.slice();
  const target = index + offset;
  if (index < 0 || index >= next.length) return next;
  if (target < 0 || target >= next.length) return next;
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}
function isScopeType(value) {
  return SCOPE_TYPES.indexOf(value) !== -1;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/settingsTab.ts
var REPO_URL = "https://github.com/jsglazer/yaml-dropdown";
var SCOPE_LABELS = {
  folder: "Folder (regex)",
  class: "DropdownClass",
  file: "File (exact path)"
};
var PATTERN_PLACEHOLDERS = {
  folder: "^Projects(/|$)",
  class: "Book",
  file: "Projects/Roadmap.md"
};
var PATTERN_DESCRIPTIONS = {
  folder: "Regular expression tested against the vault-relative parent folder (empty at vault root).",
  class: "Matched exactly, case-sensitively, against the note's DropdownClass value.",
  file: "Matched exactly against the vault-relative file path."
};
var YamlDropdownSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    this.renderHeader(containerEl);
    this.renderGeneral(containerEl);
    this.renderRules(containerEl);
  }
  renderHeader(containerEl) {
    const header = containerEl.createDiv({ cls: "yaml-dropdown-header" });
    header.createEl("a", {
      text: "github.com/jsglazer/yaml-dropdown",
      href: REPO_URL,
      cls: "yaml-dropdown-repo"
    });
    header.createSpan({
      text: `Version ${this.plugin.manifest.version}`,
      cls: "yaml-dropdown-version"
    });
  }
  renderGeneral(containerEl) {
    new import_obsidian2.Setting(containerEl).setName("Case-insensitive keys").setDesc(
      "Match frontmatter keys regardless of case. Suggestion filtering is always case-insensitive; folder, file, and DropdownClass matching are always case-sensitive."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.caseInsensitiveKeys).onChange(async (value) => {
        this.plugin.settings.caseInsensitiveKeys = value;
        await this.plugin.saveSettings();
      })
    );
  }
  renderRules(containerEl) {
    new import_obsidian2.Setting(containerEl).setName("Dropdown rules").setDesc(
      "Highest matching scope wins, in order File > DropdownClass > Folder. Value lists are never merged across scopes; within one scope the first matching rule in this list wins."
    ).setHeading().addButton(
      (button) => button.setButtonText("Add rule").setCta().onClick(async () => {
        const ids = this.plugin.settings.rules.map((rule) => rule.id);
        this.plugin.settings.rules.push(newRule(ids));
        await this.plugin.saveSettings();
        this.display();
      })
    );
    if (this.plugin.settings.rules.length === 0) {
      containerEl.createEl("p", {
        text: "No rules yet. Add one to start offering dropdown values.",
        cls: "yaml-dropdown-empty"
      });
      return;
    }
    this.plugin.settings.rules.forEach((rule, index) => {
      this.renderRule(containerEl, rule, index);
    });
  }
  renderRule(containerEl, rule, index) {
    const ruleEl = containerEl.createDiv({ cls: "yaml-dropdown-rule" });
    new import_obsidian2.Setting(ruleEl).setName(rule.key.length > 0 ? rule.key : "(no key)").setDesc(`${SCOPE_LABELS[rule.scope.type]} \u2014 ${rule.values.length} value(s)`).setHeading().addToggle(
      (toggle) => toggle.setValue(rule.enabled).setTooltip("Enable this rule").onChange(async (value) => {
        rule.enabled = value;
        await this.plugin.saveSettings();
      })
    ).addExtraButton(
      (button) => button.setIcon("arrow-up").setTooltip("Move up").setDisabled(index === 0).onClick(async () => {
        this.plugin.settings.rules = moveRule(this.plugin.settings.rules, index, -1);
        await this.plugin.saveSettings();
        this.display();
      })
    ).addExtraButton(
      (button) => button.setIcon("arrow-down").setTooltip("Move down").setDisabled(index === this.plugin.settings.rules.length - 1).onClick(async () => {
        this.plugin.settings.rules = moveRule(this.plugin.settings.rules, index, 1);
        await this.plugin.saveSettings();
        this.display();
      })
    ).addExtraButton(
      (button) => button.setIcon("trash").setTooltip("Delete rule").onClick(async () => {
        this.plugin.settings.rules.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      })
    );
    new import_obsidian2.Setting(ruleEl).setName("Frontmatter key").setDesc("The key this rule supplies values for, e.g. Status.").addText(
      (text) => text.setPlaceholder("Status").setValue(rule.key).onChange(async (value) => {
        rule.key = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(ruleEl).setName("Values").setDesc("Comma-separated. Blank entries are dropped and duplicates are removed.").addTextArea(
      (area) => area.setPlaceholder("Open, In progress, Done").setValue(formatValueList(rule.values)).onChange(async (value) => {
        rule.values = parseValueList(value);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(ruleEl).setName("Scope").addDropdown((dropdown) => {
      dropdown.addOption("folder", SCOPE_LABELS.folder).addOption("class", SCOPE_LABELS.class).addOption("file", SCOPE_LABELS.file).setValue(rule.scope.type).onChange(async (value) => {
        rule.scope.type = value;
        await this.plugin.saveSettings();
        this.display();
      });
    });
    const patternSetting = new import_obsidian2.Setting(ruleEl).setName("Pattern").setDesc(PATTERN_DESCRIPTIONS[rule.scope.type]);
    const errorEl = ruleEl.createDiv({ cls: "yaml-dropdown-error" });
    const showPatternError = (pattern) => {
      errorEl.empty();
      if (rule.scope.type !== "folder") return;
      const compiled = compileFolderPattern(pattern);
      if (compiled.ok) return;
      errorEl.setText(`Invalid regex: ${compiled.error}`);
    };
    patternSetting.addText(
      (text) => text.setPlaceholder(PATTERN_PLACEHOLDERS[rule.scope.type]).setValue(rule.scope.pattern).onChange(async (value) => {
        rule.scope.pattern = value;
        showPatternError(value);
        await this.plugin.saveSettings();
      })
    );
    showPatternError(rule.scope.pattern);
  }
};

// src/scheduler.ts
var systemScheduler = {
  defer: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clear: (handle) => window.clearTimeout(handle)
};

// src/main.ts
var YamlDropdownPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.settings = defaultSettings();
    this.suggest = null;
    this.cursorTrigger = null;
  }
  async onload() {
    this.settings = normalizeSettings(await this.loadData());
    const suggest = new DropdownSuggest(this.app, () => this.settings);
    this.suggest = suggest;
    this.registerEditorSuggest(suggest);
    const cursorTrigger = new CursorTrigger(this.app, suggest, systemScheduler);
    this.cursorTrigger = cursorTrigger;
    this.registerEditorExtension(
      import_view.EditorView.updateListener.of((update) => cursorTrigger.handleUpdate(update))
    );
    this.addSettingTab(new YamlDropdownSettingTab(this.app, this));
  }
  onunload() {
    if (this.cursorTrigger !== null) {
      this.cursorTrigger.dispose();
      this.cursorTrigger = null;
    }
    if (this.suggest !== null) {
      this.suggest.close();
      this.suggest = null;
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
