import { describe, expect, it } from "vitest";

import { buildReplacement } from "../src/core/edit";
import { detectFrontmatter, isInsideFrontmatter, parseDropdownClass } from "../src/core/frontmatter";
import { filterValues } from "../src/core/filter";
import { parentFolderPath } from "../src/core/paths";
import { resolveRule } from "../src/core/match";
import { detectTriggerPosition } from "../src/core/trigger";
import type { Rule } from "../src/core/settings";

/**
 * End-to-end exercise of the pure core in the same order the plugin shell calls it,
 * on realistic documents. Nothing here imports `obsidian` or touches the DOM.
 */
function run(doc: string, filePath: string, line: number, ch: number, rules: readonly Rule[]) {
	const lines = doc.split("\n");

	if (line === 0) return null;
	const match = detectTriggerPosition(lines[line], ch);
	if (match === null) return null;

	const range = detectFrontmatter(lines);
	if (range === null || !isInsideFrontmatter(range, line)) return null;

	const rule = resolveRule(rules, {
		key: match.key,
		filePath,
		folderPath: parentFolderPath(filePath),
		className: parseDropdownClass(lines, range),
		caseInsensitiveKeys: false,
	});
	if (rule === null) return null;

	const suggestions = filterValues(rule.values, match.query);
	return {
		suggestions,
		accept: (value: string) => buildReplacement(lines[line], match.valueStart, value),
	};
}

const folderRule: Rule = {
	id: "rule-1",
	label: "",
	key: "Status",
	values: ["Open", "In progress", "Done"],
	scope: { type: "folder", pattern: "^Projects" },
	enabled: true,
};

const classRule: Rule = {
	id: "rule-2",
	label: "",
	key: "Status",
	values: ["To read", "Reading", "Read"],
	scope: { type: "class", pattern: "Book" },
	enabled: true,
};

const RULES = [folderRule, classRule];

const DOC = ["---", "Status: ", "DropdownClass: Book", "---", "", "Body text."].join("\n");

describe("core pipeline", () => {
	it("offers the class-scoped list on a note whose DropdownClass matches", () => {
		const result = run(DOC, "Projects/Alpha/Note.md", 1, 8, RULES);
		expect(result?.suggestions).toEqual(["To read", "Reading", "Read"]);
	});

	it("falls back to the folder-scoped list when the class does not match", () => {
		const doc = DOC.replace("DropdownClass: Book", "DropdownClass: Article");
		const result = run(doc, "Projects/Alpha/Note.md", 1, 8, RULES);
		expect(result?.suggestions).toEqual(["Open", "In progress", "Done"]);
	});

	it("narrows the list as the user types, case-insensitively", () => {
		// "read" is a substring of all three values, in defined order.
		const wide = ["---", "Status: re", "DropdownClass: Book", "---"].join("\n");
		expect(run(wide, "Projects/Alpha/Note.md", 1, 10, RULES)?.suggestions).toEqual([
			"To read",
			"Reading",
			"Read",
		]);

		// Lowercase input still matches the capitalised values.
		const lower = ["---", "Status: readi", "DropdownClass: Book", "---"].join("\n");
		expect(run(lower, "Projects/Alpha/Note.md", 1, 13, RULES)?.suggestions).toEqual(["Reading"]);

		// A query matching nothing yields nothing rather than falling back to the full list.
		const none = ["---", "Status: zzz", "DropdownClass: Book", "---"].join("\n");
		expect(run(none, "Projects/Alpha/Note.md", 1, 11, RULES)?.suggestions).toEqual([]);
	});

	it("replaces an existing value in full when a suggestion is accepted", () => {
		const doc = ["---", "Status: In progress", "DropdownClass: Book", "---"].join("\n");
		const result = run(doc, "Projects/Alpha/Note.md", 1, 10, RULES);
		expect(result?.accept("Read")).toEqual({ from: 8, to: 19, text: "Read" });
	});

	it("offers nothing outside the folder scope with no matching class", () => {
		const doc = DOC.replace("DropdownClass: Book", "DropdownClass: Article");
		expect(run(doc, "Archive/Note.md", 1, 8, RULES)).toBeNull();
	});

	it("offers nothing in the note body", () => {
		const doc = ["---", "DropdownClass: Book", "---", "Status: "].join("\n");
		expect(run(doc, "Projects/Alpha/Note.md", 3, 8, RULES)).toBeNull();
	});

	it("offers nothing on the opening or closing fence", () => {
		expect(run(DOC, "Projects/Alpha/Note.md", 0, 3, RULES)).toBeNull();
		expect(run(DOC, "Projects/Alpha/Note.md", 3, 3, RULES)).toBeNull();
	});

	it("offers nothing when the document has no frontmatter", () => {
		const doc = ["# Title", "Status: "].join("\n");
		expect(run(doc, "Projects/Alpha/Note.md", 1, 8, RULES)).toBeNull();
	});

	it("offers nothing when the frontmatter is never closed", () => {
		const doc = ["---", "Status: ", "body"].join("\n");
		expect(run(doc, "Projects/Alpha/Note.md", 1, 8, RULES)).toBeNull();
	});

	it("offers nothing for an unmanaged key", () => {
		const doc = ["---", "Priority: ", "DropdownClass: Book", "---"].join("\n");
		expect(run(doc, "Projects/Alpha/Note.md", 1, 10, RULES)).toBeNull();
	});

	it("offers nothing when the colon spacing is wrong", () => {
		const zero = ["---", "Status:Open", "DropdownClass: Book", "---"].join("\n");
		expect(run(zero, "Projects/Alpha/Note.md", 1, 11, RULES)).toBeNull();

		const two = ["---", "Status:  Open", "DropdownClass: Book", "---"].join("\n");
		expect(run(two, "Projects/Alpha/Note.md", 1, 13, RULES)).toBeNull();
	});

	it("a file-scoped rule overrides both class and folder rules", () => {
		const fileRule: Rule = {
			id: "rule-3",
			label: "",
			key: "Status",
			values: ["Shipped"],
			scope: { type: "file", pattern: "Projects/Alpha/Note.md" },
			enabled: true,
		};
		const result = run(DOC, "Projects/Alpha/Note.md", 1, 8, [...RULES, fileRule]);
		expect(result?.suggestions).toEqual(["Shipped"]);
	});
});
