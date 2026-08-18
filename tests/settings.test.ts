import { describe, expect, it } from "vitest";

import {
	SCHEMA_VERSION,
	defaultSettings,
	moveRule,
	newRule,
	nextRuleId,
	normalizeRule,
	normalizeSettings,
} from "../src/core/settings";
import type { Rule } from "../src/core/settings";

const validRule = {
	id: "rule-1",
	key: "Status",
	values: ["Open", "Done"],
	scope: { type: "folder", pattern: "^Projects" },
	enabled: true,
};

describe("defaultSettings", () => {
	it("carries the schema version and no rules", () => {
		expect(defaultSettings()).toEqual({
			schemaVersion: SCHEMA_VERSION,
			rules: [],
			caseInsensitiveKeys: false,
		});
	});

	it("returns a fresh object each call", () => {
		const a = defaultSettings();
		a.rules.push(validRule as Rule);
		expect(defaultSettings().rules).toEqual([]);
	});
});

describe("normalizeSettings", () => {
	it("returns defaults for absent or non-object data", () => {
		for (const raw of [undefined, null, 42, "x", []]) {
			expect(normalizeSettings(raw)).toEqual(defaultSettings());
		}
	});

	it("keeps valid data", () => {
		const settings = normalizeSettings({
			schemaVersion: 1,
			caseInsensitiveKeys: true,
			rules: [validRule],
		});
		expect(settings.caseInsensitiveKeys).toBe(true);
		expect(settings.rules).toHaveLength(1);
		expect(settings.rules[0].key).toBe("Status");
	});

	it("drops malformed rules rather than throwing", () => {
		const settings = normalizeSettings({
			rules: [validRule, null, {}, { id: "x" }, { ...validRule, scope: { type: "global" } }],
		});
		expect(settings.rules).toHaveLength(1);
	});

	it("never persists a global scope type", () => {
		const settings = normalizeSettings({
			rules: [{ ...validRule, id: "rule-2", scope: { type: "global", pattern: "" } }],
		});
		expect(settings.rules).toEqual([]);
	});

	it("drops non-string values from a rule's value list", () => {
		const settings = normalizeSettings({
			rules: [{ ...validRule, values: ["Open", 3, null, "Done"] }],
		});
		expect(settings.rules[0].values).toEqual(["Open", "Done"]);
	});

	it("defaults a missing enabled flag to true", () => {
		const { enabled, ...withoutEnabled } = validRule;
		expect(normalizeSettings({ rules: [withoutEnabled] }).rules[0].enabled).toBe(true);
	});

	it("respects an explicit enabled: false", () => {
		expect(
			normalizeSettings({ rules: [{ ...validRule, enabled: false }] }).rules[0].enabled,
		).toBe(false);
	});
});

describe("normalizeRule", () => {
	it("accepts every non-global scope type", () => {
		for (const type of ["folder", "class", "file"]) {
			expect(normalizeRule({ ...validRule, scope: { type, pattern: "p" } })).not.toBeNull();
		}
	});

	it("rejects a rule with no id", () => {
		expect(normalizeRule({ ...validRule, id: "" })).toBeNull();
	});
});

describe("nextRuleId", () => {
	it("is deterministic and free of randomness or clocks", () => {
		expect(nextRuleId([])).toBe("rule-1");
		expect(nextRuleId([])).toBe("rule-1");
	});

	it("takes one past the highest existing number", () => {
		expect(nextRuleId(["rule-1", "rule-2"])).toBe("rule-3");
		expect(nextRuleId(["rule-2", "rule-1"])).toBe("rule-3");
	});

	it("does not reuse an id after a middle rule is deleted", () => {
		expect(nextRuleId(["rule-1", "rule-3"])).toBe("rule-4");
	});

	it("ignores ids in other formats", () => {
		expect(nextRuleId(["legacy", "rule-x"])).toBe("rule-1");
	});
});

describe("newRule", () => {
	it("starts enabled, scoped to folder, with no values", () => {
		expect(newRule([])).toEqual({
			id: "rule-1",
			key: "",
			values: [],
			scope: { type: "folder", pattern: "" },
			enabled: true,
		});
	});
});

describe("moveRule", () => {
	const rules = ["a", "b", "c"].map((id) => ({ ...validRule, id })) as Rule[];
	const ids = (list: Rule[]) => list.map((rule) => rule.id);

	it("moves a rule up", () => {
		expect(ids(moveRule(rules, 1, -1))).toEqual(["b", "a", "c"]);
	});

	it("moves a rule down", () => {
		expect(ids(moveRule(rules, 1, 1))).toEqual(["a", "c", "b"]);
	});

	it("is a no-op at the edges", () => {
		expect(ids(moveRule(rules, 0, -1))).toEqual(["a", "b", "c"]);
		expect(ids(moveRule(rules, 2, 1))).toEqual(["a", "b", "c"]);
	});

	it("is a no-op for an out-of-range index", () => {
		expect(ids(moveRule(rules, 9, -1))).toEqual(["a", "b", "c"]);
	});

	it("does not mutate the input array", () => {
		moveRule(rules, 1, -1);
		expect(ids(rules)).toEqual(["a", "b", "c"]);
	});
});
