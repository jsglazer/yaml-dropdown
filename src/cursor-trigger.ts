import type { ViewUpdate } from "@codemirror/view";
import type { App } from "obsidian";

import { forceSuggestTrigger } from "./adapters/suggest-trigger";
import {
	CURSOR_TRIGGER_DELAY_MS,
	Debouncer,
	Scheduler,
	createTrailingDebouncer,
} from "./core/debounce";
import { shouldRetrigger } from "./core/reentry";
import type { DropdownSuggest } from "./suggest";

/**
 * The plugin's one and only auto-trigger mechanism: a CodeMirror 6
 * `EditorView.updateListener`, registered through `registerEditorExtension`.
 *
 * There is deliberately no document-level `selectionchange` listener, no global
 * keydown handler, and no MutationObserver — iOS soft-keyboard input flows
 * through this same path.
 */
export class CursorTrigger {
	private readonly app: App;
	private readonly suggest: DropdownSuggest;
	private readonly debouncer: Debouncer;

	constructor(
		app: App,
		suggest: DropdownSuggest,
		scheduler: Scheduler,
		delayMs: number = CURSOR_TRIGGER_DELAY_MS,
	) {
		this.app = app;
		this.suggest = suggest;
		this.debouncer = createTrailingDebouncer(scheduler, delayMs);
	}

	handleUpdate(update: ViewUpdate): void {
		// Typing is already forced through EditorSuggest by Obsidian's own update
		// listener. Re-triggering it here would double-fire on every keystroke and
		// risk a trigger loop, so the keystroke path is left alone — and, per the
		// build constraints, is never debounced by us.
		if (update.docChanged) return;
		if (!update.selectionSet) return;
		this.debouncer.schedule(() => this.fire());
	}

	/** Cancel any pending trailing callback so it cannot fire into an unloaded plugin. */
	dispose(): void {
		this.debouncer.cancel();
	}

	private fire(): void {
		const active = this.app.workspace.activeEditor;
		if (!active) return;

		const editor = active.editor;
		const file = active.file;
		if (!editor || file === null) return;

		// Resolve first, so we only poke the suggest manager at a site we would
		// actually serve. Triggering unconditionally would close whichever suggest
		// (link, tag, …) the user currently has open.
		const resolved = this.suggest.resolve(editor, file, editor.getCursor());
		if (resolved === null) return;

		if (!shouldRetrigger(this.suggest.isPopupOpen(), this.suggest.openSite(), resolved.site)) {
			return;
		}

		forceSuggestTrigger(this.app, editor, file);
	}
}
