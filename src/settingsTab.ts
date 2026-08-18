import { App, PluginSettingTab, Setting } from "obsidian";

import { compileFolderPattern } from "./core/scope";
import { formatValueList, parseValueList } from "./core/values";
import { moveRule, newRule } from "./core/settings";
import type { Rule, ScopeType } from "./core/settings";
import type YamlDropdownPlugin from "./main";

const REPO_URL = "https://github.com/jsglazer/yaml-dropdown";

const SCOPE_LABELS: Record<ScopeType, string> = {
	folder: "Folder (regex)",
	class: "DropdownClass",
	file: "File (exact path)",
};

const PATTERN_PLACEHOLDERS: Record<ScopeType, string> = {
	folder: "^Projects(/|$)",
	class: "Book",
	file: "Projects/Roadmap.md",
};

const PATTERN_DESCRIPTIONS: Record<ScopeType, string> = {
	folder: "Regular expression tested against the vault-relative parent folder (empty at vault root).",
	class: "Matched exactly, case-sensitively, against the note's DropdownClass value.",
	file: "Matched exactly against the vault-relative file path.",
};

export class YamlDropdownSettingTab extends PluginSettingTab {
	private readonly plugin: YamlDropdownPlugin;

	constructor(app: App, plugin: YamlDropdownPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.renderHeader(containerEl);
		this.renderGeneral(containerEl);
		this.renderRules(containerEl);
	}

	private renderHeader(containerEl: HTMLElement): void {
		const header = containerEl.createDiv({ cls: "yaml-dropdown-header" });
		header.createEl("a", {
			text: "github.com/jsglazer/yaml-dropdown",
			href: REPO_URL,
			cls: "yaml-dropdown-repo",
		});
		// Read from the manifest at runtime so the version is never hardcoded here.
		header.createSpan({
			text: `Version ${this.plugin.manifest.version}`,
			cls: "yaml-dropdown-version",
		});
	}

	private renderGeneral(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Case-insensitive keys")
			.setDesc(
				"Match frontmatter keys regardless of case. Suggestion filtering is always " +
					"case-insensitive; folder, file, and DropdownClass matching are always case-sensitive.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.caseInsensitiveKeys).onChange(async (value) => {
					this.plugin.settings.caseInsensitiveKeys = value;
					await this.plugin.saveSettings();
				}),
			);
	}

	private renderRules(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Dropdown rules")
			.setDesc(
				"Highest matching scope wins, in order File > DropdownClass > Folder. " +
					"Value lists are never merged across scopes; within one scope the first " +
					"matching rule in this list wins.",
			)
			.setHeading()
			.addButton((button) =>
				button
					.setButtonText("Add rule")
					.setCta()
					.onClick(async () => {
						const ids = this.plugin.settings.rules.map((rule) => rule.id);
						this.plugin.settings.rules.push(newRule(ids));
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.rules.length === 0) {
			containerEl.createEl("p", {
				text: "No rules yet. Add one to start offering dropdown values.",
				cls: "yaml-dropdown-empty",
			});
			return;
		}

		this.plugin.settings.rules.forEach((rule, index) => {
			this.renderRule(containerEl, rule, index);
		});
	}

	private renderRule(containerEl: HTMLElement, rule: Rule, index: number): void {
		const ruleEl = containerEl.createDiv({ cls: "yaml-dropdown-rule" });

		new Setting(ruleEl)
			.setName(rule.key.length > 0 ? rule.key : "(no key)")
			.setDesc(`${SCOPE_LABELS[rule.scope.type]} — ${rule.values.length} value(s)`)
			.setHeading()
			.addToggle((toggle) =>
				toggle
					.setValue(rule.enabled)
					.setTooltip("Enable this rule")
					.onChange(async (value) => {
						rule.enabled = value;
						await this.plugin.saveSettings();
					}),
			)
			.addExtraButton((button) =>
				button
					.setIcon("arrow-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(async () => {
						this.plugin.settings.rules = moveRule(this.plugin.settings.rules, index, -1);
						await this.plugin.saveSettings();
						this.display();
					}),
			)
			.addExtraButton((button) =>
				button
					.setIcon("arrow-down")
					.setTooltip("Move down")
					.setDisabled(index === this.plugin.settings.rules.length - 1)
					.onClick(async () => {
						this.plugin.settings.rules = moveRule(this.plugin.settings.rules, index, 1);
						await this.plugin.saveSettings();
						this.display();
					}),
			)
			.addExtraButton((button) =>
				button
					.setIcon("trash")
					.setTooltip("Delete rule")
					.onClick(async () => {
						this.plugin.settings.rules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		new Setting(ruleEl)
			.setName("Frontmatter key")
			.setDesc("The key this rule supplies values for, e.g. Status.")
			.addText((text) =>
				text
					.setPlaceholder("Status")
					.setValue(rule.key)
					.onChange(async (value) => {
						rule.key = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(ruleEl)
			.setName("Values")
			.setDesc("Comma-separated. Blank entries are dropped and duplicates are removed.")
			.addTextArea((area) =>
				area
					.setPlaceholder("Open, In progress, Done")
					.setValue(formatValueList(rule.values))
					.onChange(async (value) => {
						rule.values = parseValueList(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(ruleEl)
			.setName("Scope")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("folder", SCOPE_LABELS.folder)
					.addOption("class", SCOPE_LABELS.class)
					.addOption("file", SCOPE_LABELS.file)
					.setValue(rule.scope.type)
					.onChange(async (value) => {
						rule.scope.type = value as ScopeType;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		const patternSetting = new Setting(ruleEl)
			.setName("Pattern")
			.setDesc(PATTERN_DESCRIPTIONS[rule.scope.type]);

		const errorEl = ruleEl.createDiv({ cls: "yaml-dropdown-error" });
		const showPatternError = (pattern: string): void => {
			errorEl.empty();
			if (rule.scope.type !== "folder") return;
			const compiled = compileFolderPattern(pattern);
			if (compiled.ok) return;
			// Invalid patterns are reported inline and skipped during matching —
			// they never throw and never break this tab.
			errorEl.setText(`Invalid regex: ${compiled.error}`);
		};

		patternSetting.addText((text) =>
			text
				.setPlaceholder(PATTERN_PLACEHOLDERS[rule.scope.type])
				.setValue(rule.scope.pattern)
				.onChange(async (value) => {
					rule.scope.pattern = value;
					showPatternError(value);
					await this.plugin.saveSettings();
				}),
		);

		showPatternError(rule.scope.pattern);
	}
}
