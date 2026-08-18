import { Plugin } from "obsidian";
import { EditorView } from "@codemirror/view";

import { CursorTrigger } from "./cursor-trigger";
import { DropdownSuggest } from "./suggest";
import { YamlDropdownSettingTab } from "./settingsTab";
import { defaultSettings, normalizeSettings } from "./core/settings";
import type { YamlDropdownSettings } from "./core/settings";
import { systemScheduler } from "./scheduler";

export default class YamlDropdownPlugin extends Plugin {
	settings: YamlDropdownSettings = defaultSettings();

	private suggest: DropdownSuggest | null = null;
	private cursorTrigger: CursorTrigger | null = null;

	async onload(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());

		// Typing-driven suggestions come from the documented EditorSuggest API.
		const suggest = new DropdownSuggest(this.app, () => this.settings);
		this.suggest = suggest;
		this.registerEditorSuggest(suggest);

		// Cursor-move suggestions come from exactly one CM6 updateListener.
		const cursorTrigger = new CursorTrigger(this.app, suggest, systemScheduler);
		this.cursorTrigger = cursorTrigger;
		this.registerEditorExtension(
			EditorView.updateListener.of((update) => cursorTrigger.handleUpdate(update)),
		);

		this.addSettingTab(new YamlDropdownSettingTab(this.app, this));
	}

	onunload(): void {
		// `registerEditorSuggest`, `registerEditorExtension`, and `addSettingTab` are
		// unregistered by Plugin's own teardown. The pending debounce timer is ours
		// alone, so cancel it explicitly — otherwise a trailing callback could fire
		// into an unloaded plugin. No other listeners, DOM bindings, or intervals are
		// created anywhere in this plugin.
		if (this.cursorTrigger !== null) {
			this.cursorTrigger.dispose();
			this.cursorTrigger = null;
		}
		if (this.suggest !== null) {
			this.suggest.close();
			this.suggest = null;
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
