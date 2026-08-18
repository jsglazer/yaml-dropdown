import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";

import {
	CLASS_KEY,
	FrontmatterRange,
	MAX_FRONTMATTER_SCAN_LINES,
	detectFrontmatter,
	isInsideFrontmatter,
	parseDropdownClass,
} from "./core/frontmatter";
import { buildReplacement } from "./core/edit";
import { filterValues } from "./core/filter";
import { parentFolderPath } from "./core/paths";
import { resolveRule } from "./core/match";
import type { TriggerSite } from "./core/reentry";
import type { YamlDropdownSettings } from "./core/settings";
import { detectTriggerPosition } from "./core/trigger";

export interface ResolvedTrigger {
	readonly site: TriggerSite;
	readonly query: string;
	readonly values: readonly string[];
}

/**
 * Documented `EditorSuggest` subclass. Obsidian drives `onTrigger` on every
 * keystroke; the cursor-move path (see `CursorTrigger`) reuses `resolve` so both
 * paths agree on what counts as a trigger site.
 *
 * Every Obsidian object is unwrapped here at the shell boundary — the modules
 * under `src/core/` receive only line strings, offsets, and plain paths.
 */
export class DropdownSuggest extends EditorSuggest<string> {
	private readonly getSettings: () => YamlDropdownSettings;
	private popupOpen = false;

	constructor(app: App, getSettings: () => YamlDropdownSettings) {
		super(app);
		this.getSettings = getSettings;
	}

	// `open()` and `close()` are documented, overridable members of PopoverSuggest.
	// Tracking the flag here keeps the re-entry guard off `isOpen`, which is not
	// part of the public API.
	open(): void {
		this.popupOpen = true;
		super.open();
	}

	close(): void {
		this.popupOpen = false;
		super.close();
	}

	isPopupOpen(): boolean {
		return this.popupOpen;
	}

	/** The site the popup is currently open for, from the public `context`. */
	openSite(): TriggerSite | null {
		const context = this.context;
		if (context === null) return null;
		return { line: context.start.line, valueStart: context.start.ch };
	}

	/**
	 * Single source of truth for "is this a dropdown site, and which values apply".
	 * Reads nothing but editor text — no file writes, no network, no metadata-cache
	 * dependency while the editor has content.
	 */
	resolve(editor: Editor, file: TFile | null, cursor: EditorPosition): ResolvedTrigger | null {
		if (file === null) return null;
		// Line 0 is the opening fence, so it can never hold a key.
		if (cursor.line === 0) return null;

		// Cheapest rejection first: a single-line string scan. On a normal keystroke
		// in the note body this returns null before any multi-line work happens.
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
			caseInsensitiveKeys: settings.caseInsensitiveKeys,
		});
		if (rule === null) return null;

		return {
			site: { line: cursor.line, valueStart: match.valueStart },
			query: match.query,
			values: rule.values,
		};
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		const resolved = this.resolve(editor, file, cursor);
		if (resolved === null) return null;
		return {
			start: { line: resolved.site.line, ch: resolved.site.valueStart },
			end: cursor,
			query: resolved.query,
		};
	}

	getSuggestions(context: EditorSuggestContext): string[] {
		const resolved = this.resolve(context.editor, context.file, context.end);
		if (resolved === null) return [];
		return filterValues(resolved.values, context.query);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string, _evt: MouseEvent | KeyboardEvent): void {
		const context = this.context;
		if (context === null) return;

		const editor = context.editor;
		const line = context.start.line;
		const replacement = buildReplacement(editor.getLine(line), context.start.ch, value);

		editor.replaceRange(
			replacement.text,
			{ line, ch: replacement.from },
			{ line, ch: replacement.to },
		);
		editor.setCursor({ line, ch: replacement.from + replacement.text.length });
		this.close();
	}

	/**
	 * Editor text is authoritative. The metadata cache is consulted only when the
	 * editor yields no text at all, so nothing here depends on cache timing while
	 * the user is typing.
	 */
	private readDropdownClass(
		lines: readonly string[],
		range: FrontmatterRange,
		file: TFile,
	): string | null {
		if (lines.length > 0) return parseDropdownClass(lines, range);

		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		const raw = frontmatter === undefined ? undefined : frontmatter[CLASS_KEY];
		return typeof raw === "string" ? raw : null;
	}
}

function readHeadLines(editor: Editor, maxLines: number): string[] {
	const count = Math.min(editor.lineCount(), maxLines);
	const lines: string[] = [];
	for (let i = 0; i < count; i++) lines.push(editor.getLine(i));
	return lines;
}
