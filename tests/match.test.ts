import { describe, expect, it } from "vitest";

import { resolveRule } from "../src/core/match";
import type { MatchContext } from "../src/core/match";
import type { Rule, ScopeType } from "../src/core/settings";

let idCounter = 0;

function rule(
	key: string,
	type: ScopeType,
	pattern: string,
	values: string[],
	enabled = true,
): Rule {
	idCounter += 1;
	return { id: `rule-${idCounter}`, key, values, scope: { type, pattern }, enabled };
}

function context(overrides: Partial<MatchContext> = {}): MatchContext {
	return {
		key: "Status",
		filePath: "Projects/Alpha/Roadmap.md",
		folderPath: "Projects/Alpha",
		className: "Book",
		caseInsensitiveKeys: false,
		...overrides,
	};
}

describe("resolveRule — precedence", () => {
	const folderRule = rule("Status", "folder", "^Projects", ["F1", "F2"]);
	const classRule = rule("Status", "class", "Book", ["C1"]);
	const fileRule = rule("Status", "file", "Projects/Alpha/Roadmap.md", ["X1"]);

	it("File beats Class and Folder", () => {
		expect(resolveRule([folderRule, classRule, fileRule], context())).toBe(fileRule);
	});

	it("Class beats Folder", () => {
		expect(resolveRule([folderRule, classRule], context())).toBe(classRule);
	});

	it("Folder applies when it is the only match", () => {
		expect(resolveRule([folderRule], context())).toBe(folderRule);
	});

	it("precedence is independent of the order rules appear in settings", () => {
		expect(resolveRule([fileRule, classRule, folderRule], context())).toBe(fileRule);
		expect(resolveRule([classRule, fileRule, folderRule], context())).toBe(fileRule);
		expect(resolveRule([folderRule, fileRule, classRule], context())).toBe(fileRule);
	});

	it("is winner-takes-all: the winning list is never merged with lower tiers", () => {
		const winner = resolveRule([folderRule, classRule, fileRule], context());
		expect(winner?.values).toEqual(["X1"]);
	});

	it("falls through to the next tier when the higher tier does not match", () => {
		const otherFile = rule("Status", "file", "Other/Note.md", ["X1"]);
		expect(resolveRule([folderRule, classRule, otherFile], context())).toBe(classRule);
	});

	it("returns null when nothing matches", () => {
		expect(resolveRule([folderRule], context({ folderPath: "Archive" }))).toBeNull();
		expect(resolveRule([], context())).toBeNull();
	});
});

describe("resolveRule — ties within a tier", () => {
	it("takes the first matching rule in settings order", () => {
		const first = rule("Status", "folder", "^Projects", ["A"]);
		const second = rule("Status", "folder", "^Projects", ["B"]);
		expect(resolveRule([first, second], context())).toBe(first);
		expect(resolveRule([second, first], context())).toBe(second);
	});

	it("skips a disabled rule and lets the next one in the tier win", () => {
		const disabled = rule("Status", "folder", "^Projects", ["A"], false);
		const enabled = rule("Status", "folder", "^Projects", ["B"]);
		expect(resolveRule([disabled, enabled], context())).toBe(enabled);
	});

	it("a disabled higher-tier rule does not block a lower tier", () => {
		const disabledFile = rule("Status", "file", "Projects/Alpha/Roadmap.md", ["X"], false);
		const folderRule = rule("Status", "folder", "^Projects", ["F"]);
		expect(resolveRule([disabledFile, folderRule], context())).toBe(folderRule);
	});
});

describe("resolveRule — key matching", () => {
	const statusRule = rule("Status", "folder", "", ["A"]);

	it("is case-sensitive by default", () => {
		expect(resolveRule([statusRule], context({ key: "status" }))).toBeNull();
		expect(resolveRule([statusRule], context({ key: "Status" }))).toBe(statusRule);
	});

	it("folds case when caseInsensitiveKeys is on", () => {
		const ctx = context({ key: "status", caseInsensitiveKeys: true });
		expect(resolveRule([statusRule], ctx)).toBe(statusRule);
		expect(resolveRule([statusRule], context({ key: "STATUS", caseInsensitiveKeys: true }))).toBe(
			statusRule,
		);
	});

	it("does not match a different key", () => {
		expect(resolveRule([statusRule], context({ key: "Priority" }))).toBeNull();
	});
});

describe("resolveRule — scope semantics", () => {
	it("folder patterns are regexes over the parent folder path", () => {
		const r = rule("Status", "folder", "^Projects/Alpha$", ["A"]);
		expect(resolveRule([r], context({ folderPath: "Projects/Alpha" }))).toBe(r);
		expect(resolveRule([r], context({ folderPath: "Projects/Alpha/Sub" }))).toBeNull();
	});

	it("an empty folder pattern matches every folder, including vault root", () => {
		const r = rule("Status", "folder", "", ["A"]);
		expect(resolveRule([r], context({ folderPath: "" }))).toBe(r);
		expect(resolveRule([r], context({ folderPath: "Deep/Nested" }))).toBe(r);
	});

	it("a folder pattern anchored to vault root matches only the root", () => {
		const r = rule("Status", "folder", "^$", ["A"]);
		expect(resolveRule([r], context({ folderPath: "" }))).toBe(r);
		expect(resolveRule([r], context({ folderPath: "Projects" }))).toBeNull();
	});

	it("folder matching is case-sensitive", () => {
		const r = rule("Status", "folder", "^projects", ["A"]);
		expect(resolveRule([r], context({ folderPath: "Projects" }))).toBeNull();
	});

	it("an invalid folder regex is skipped, never thrown", () => {
		const broken = rule("Status", "folder", "([", ["A"]);
		const good = rule("Status", "folder", "^Projects", ["B"]);
		expect(() => resolveRule([broken, good], context())).not.toThrow();
		expect(resolveRule([broken, good], context())).toBe(good);
		expect(resolveRule([broken], context())).toBeNull();
	});

	it("file scope matches the exact vault-relative path, case-sensitively", () => {
		const r = rule("Status", "file", "Projects/Alpha/Roadmap.md", ["A"]);
		expect(resolveRule([r], context())).toBe(r);
		expect(resolveRule([r], context({ filePath: "Projects/Alpha/roadmap.md" }))).toBeNull();
		expect(resolveRule([r], context({ filePath: "Alpha/Roadmap.md" }))).toBeNull();
	});

	it("file scope is not a regex", () => {
		const r = rule("Status", "file", "^Projects.*md$", ["A"]);
		expect(resolveRule([r], context())).toBeNull();
	});

	it("class scope matches the DropdownClass value exactly, case-sensitively", () => {
		const r = rule("Status", "class", "Book", ["A"]);
		expect(resolveRule([r], context({ className: "Book" }))).toBe(r);
		expect(resolveRule([r], context({ className: "book" }))).toBeNull();
		expect(resolveRule([r], context({ className: "Bookmark" }))).toBeNull();
	});

	it("class scope never matches a note without a DropdownClass", () => {
		const r = rule("Status", "class", "Book", ["A"]);
		expect(resolveRule([r], context({ className: null }))).toBeNull();
	});
});
