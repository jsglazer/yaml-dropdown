import type { App, Editor, TFile } from "obsidian";

/**
 * The ONLY place in this plugin that touches an undocumented Obsidian internal.
 * If the internal changes shape, this file is the whole fix.
 *
 * Verified against Obsidian 1.13.7 (`obsidian-1.13.7.asar`):
 *
 *   EditorSuggestManager.prototype.trigger = function (editor, file, force) {
 *     if (editor.cm.hasFocus) {
 *       for (const suggest of this.suggests) {
 *         if (suggest.trigger(editor, file, force)) {
 *           if (force) this.setCurrentSuggest(suggest);
 *           return;
 *         }
 *       }
 *       this.close();
 *     }
 *   };
 *
 * `force` must be true. `EditorSuggest.prototype.trigger` only calls
 * `getSuggestions`/`showSuggestions` when `force || this.isOpen`, so a `false`
 * here sets the context and shows nothing — which is also exactly what Obsidian's
 * own 50 ms-debounced update listener already does on a selection change. Going
 * through the *manager* rather than the suggest instance also gets us
 * `setCurrentSuggest`, without which the popup opens but Arrow/Enter/Tab are not
 * routed to it.
 */

type ManagerTrigger = (editor: Editor, file: TFile | null, force: boolean) => void;

interface EditorSuggestManagerLike {
	trigger?: unknown;
}

interface WorkspaceWithSuggestManager {
	editorSuggest?: EditorSuggestManagerLike;
}

/**
 * Force the editor-suggest manager to re-evaluate and show suggestions at the
 * current cursor. Returns whether the internal was available and ran.
 *
 * When the internal is missing or throws, the plugin degrades silently to
 * typing-triggered suggestions only: it never throws, never logs, and never
 * disables itself.
 */
export function forceSuggestTrigger(app: App, editor: Editor, file: TFile | null): boolean {
	const workspace = app.workspace as unknown as WorkspaceWithSuggestManager;
	const manager = workspace.editorSuggest;
	if (!manager || typeof manager.trigger !== "function") return false;

	try {
		(manager.trigger as ManagerTrigger).call(manager, editor, file, true);
		return true;
	} catch (error) {
		return false;
	}
}
