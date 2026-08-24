/**
 * Settings shape and normalisation. Pure data in, pure data out — nothing here
 * imports `obsidian`, touches the DOM, or performs I/O.
 */

/** Scope tiers, in the order a rule may be attached. There is no `global` tier. */
export type ScopeType = "folder" | "class" | "file";

export interface RuleScope {
	type: ScopeType;
	/** RegExp source for `folder`; an exact literal for `file` and `class`. */
	pattern: string;
}

export interface Rule {
	id: string;
	/** Optional user-supplied name for this rule, shown in place of the key when set. */
	label: string;
	/** The frontmatter key this rule supplies values for. */
	key: string;
	/** Parsed value list. The raw comma-separated string is never persisted. */
	values: string[];
	scope: RuleScope;
	enabled: boolean;
}

export interface YamlDropdownSettings {
	schemaVersion: number;
	/** One flat, user-orderable array. Order decides ties within a tier. */
	rules: Rule[];
	/** Governs frontmatter *key* matching only — never query, path, or class matching. */
	caseInsensitiveKeys: boolean;
}

export const SCHEMA_VERSION = 1;

const SCOPE_TYPES: readonly ScopeType[] = ["folder", "class", "file"];

export function defaultSettings(): YamlDropdownSettings {
	return { schemaVersion: SCHEMA_VERSION, rules: [], caseInsensitiveKeys: false };
}

/**
 * Coerce whatever `loadData()` returned into a valid settings object. Unknown or
 * malformed rules are dropped rather than allowed to throw at trigger time.
 */
export function normalizeSettings(raw: unknown): YamlDropdownSettings {
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

export function normalizeRule(raw: unknown): Rule | null {
	if (!isRecord(raw)) return null;
	if (typeof raw.id !== "string" || raw.id.length === 0) return null;
	if (typeof raw.key !== "string") return null;
	if (!isRecord(raw.scope)) return null;

	const type = raw.scope.type;
	if (typeof type !== "string" || !isScopeType(type)) return null;
	if (typeof raw.scope.pattern !== "string") return null;

	const values: string[] = [];
	if (Array.isArray(raw.values)) {
		for (const value of raw.values) {
			if (typeof value === "string") values.push(value);
		}
	}

	return {
		id: raw.id,
		label: typeof raw.label === "string" ? raw.label : "",
		key: raw.key,
		values,
		scope: { type, pattern: raw.scope.pattern },
		enabled: raw.enabled !== false,
	};
}

/**
 * Deterministic id allocation — no randomness, no clock, so tests stay repeatable.
 * Returns the lowest `rule-N` not already present in `existingIds`.
 */
export function nextRuleId(existingIds: readonly string[]): string {
	let highest = 0;
	for (const id of existingIds) {
		const match = /^rule-(\d+)$/.exec(id);
		if (match === null) continue;
		const n = Number(match[1]);
		if (Number.isFinite(n) && n > highest) highest = n;
	}
	return `rule-${highest + 1}`;
}

export function newRule(existingIds: readonly string[]): Rule {
	return {
		id: nextRuleId(existingIds),
		label: "",
		key: "",
		values: [],
		scope: { type: "folder", pattern: "" },
		enabled: true,
	};
}

/**
 * Copy the rule at `index`, inserting the copy directly after it with a fresh id.
 * Returns a new array; out-of-range is a no-op.
 */
export function duplicateRule(rules: readonly Rule[], index: number): Rule[] {
	if (index < 0 || index >= rules.length) return rules.slice();
	const source = rules[index];
	const copy: Rule = {
		...source,
		id: nextRuleId(rules.map((rule) => rule.id)),
		scope: { ...source.scope },
		values: source.values.slice(),
	};
	const next = rules.slice();
	next.splice(index + 1, 0, copy);
	return next;
}

/** Move the rule at `index` by `offset` places. Returns a new array; out-of-range is a no-op. */
export function moveRule(rules: readonly Rule[], index: number, offset: number): Rule[] {
	const next = rules.slice();
	const target = index + offset;
	if (index < 0 || index >= next.length) return next;
	if (target < 0 || target >= next.length) return next;
	const [moved] = next.splice(index, 1);
	next.splice(target, 0, moved);
	return next;
}

function isScopeType(value: string): value is ScopeType {
	return SCOPE_TYPES.indexOf(value as ScopeType) !== -1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
