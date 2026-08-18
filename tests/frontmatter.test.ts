import { describe, expect, it } from "vitest";

import {
	CLASS_KEY,
	MAX_FRONTMATTER_SCAN_LINES,
	detectFrontmatter,
	isInsideFrontmatter,
	parseDropdownClass,
} from "../src/core/frontmatter";

const lines = (text: string): string[] => text.split("\n");

describe("detectFrontmatter", () => {
	it("detects a block closed by ---", () => {
		expect(detectFrontmatter(lines("---\nStatus: Open\n---\nbody"))).toEqual({
			startLine: 0,
			endLine: 2,
		});
	});

	it("detects a block closed by ...", () => {
		expect(detectFrontmatter(lines("---\nStatus: Open\n...\nbody"))).toEqual({
			startLine: 0,
			endLine: 2,
		});
	});

	it("tolerates trailing whitespace on either fence", () => {
		expect(detectFrontmatter(lines("---  \nStatus: Open\n--- \n"))).toEqual({
			startLine: 0,
			endLine: 2,
		});
	});

	it("returns null when the opening fence is not on line 0", () => {
		expect(detectFrontmatter(lines("\n---\nStatus: Open\n---"))).toBeNull();
		expect(detectFrontmatter(lines("# Title\n---\nStatus: Open\n---"))).toBeNull();
	});

	it("returns null when anything precedes the fence on line 0", () => {
		expect(detectFrontmatter(lines(" ---\nStatus: Open\n---"))).toBeNull();
		expect(detectFrontmatter(lines("x---\nStatus: Open\n---"))).toBeNull();
	});

	it("returns null for an empty document", () => {
		expect(detectFrontmatter([])).toBeNull();
	});

	it("returns null when there is no closing fence at all", () => {
		expect(detectFrontmatter(lines("---\nStatus: Open\nbody"))).toBeNull();
	});

	it("finds a closing fence on the last line of the scan window", () => {
		const doc = ["---"];
		for (let i = 1; i < MAX_FRONTMATTER_SCAN_LINES - 1; i++) doc.push(`key${i}: v`);
		doc.push("---");
		expect(doc.length).toBe(MAX_FRONTMATTER_SCAN_LINES);
		expect(detectFrontmatter(doc)).toEqual({
			startLine: 0,
			endLine: MAX_FRONTMATTER_SCAN_LINES - 1,
		});
	});

	it("treats a closing fence past the scan window as no frontmatter", () => {
		const doc = ["---"];
		for (let i = 1; i < MAX_FRONTMATTER_SCAN_LINES; i++) doc.push(`key${i}: v`);
		doc.push("---");
		expect(doc.length).toBe(MAX_FRONTMATTER_SCAN_LINES + 1);
		expect(detectFrontmatter(doc)).toBeNull();
	});
});

describe("isInsideFrontmatter", () => {
	const range = { startLine: 0, endLine: 3 };

	it("excludes both fences", () => {
		expect(isInsideFrontmatter(range, 0)).toBe(false);
		expect(isInsideFrontmatter(range, 3)).toBe(false);
	});

	it("includes content lines", () => {
		expect(isInsideFrontmatter(range, 1)).toBe(true);
		expect(isInsideFrontmatter(range, 2)).toBe(true);
	});

	it("excludes lines in the body", () => {
		expect(isInsideFrontmatter(range, 4)).toBe(false);
	});
});

describe("parseDropdownClass", () => {
	const parse = (text: string): string | null => {
		const doc = lines(text);
		const range = detectFrontmatter(doc);
		expect(range).not.toBeNull();
		return parseDropdownClass(doc, range!);
	};

	it("uses the fixed literal key", () => {
		expect(CLASS_KEY).toBe("DropdownClass");
	});

	it("reads a plain scalar", () => {
		expect(parse("---\nDropdownClass: Book\n---")).toBe("Book");
	});

	it("trims surrounding whitespace", () => {
		expect(parse("---\nDropdownClass:    Book   \n---")).toBe("Book");
	});

	it("strips matching double or single quotes", () => {
		expect(parse('---\nDropdownClass: "Book"\n---')).toBe("Book");
		expect(parse("---\nDropdownClass: 'Book'\n---")).toBe("Book");
	});

	it("keeps commas inside an explicitly quoted scalar", () => {
		expect(parse('---\nDropdownClass: "Book, Long"\n---')).toBe("Book, Long");
	});

	it("ignores comma-separated unquoted class values", () => {
		expect(parse("---\nDropdownClass: Book, Article\n---")).toBeNull();
	});

	it("ignores inline arrays", () => {
		expect(parse("---\nDropdownClass: [Book, Article]\n---")).toBeNull();
	});

	it("ignores block lists", () => {
		expect(parse("---\nDropdownClass:\n  - Book\n---")).toBeNull();
	});

	it("returns null for an empty value", () => {
		expect(parse("---\nDropdownClass:\n---")).toBeNull();
		expect(parse("---\nDropdownClass:   \n---")).toBeNull();
	});

	it("returns null when the key is absent", () => {
		expect(parse("---\nStatus: Open\n---")).toBeNull();
	});

	it("is case-sensitive on the key", () => {
		expect(parse("---\ndropdownclass: Book\n---")).toBeNull();
	});

	it("does not match a key that merely starts with DropdownClass", () => {
		expect(parse("---\nDropdownClassName: Book\n---")).toBeNull();
	});

	it("ignores an occurrence outside the frontmatter range", () => {
		expect(parse("---\nStatus: Open\n---\nDropdownClass: Book")).toBeNull();
	});

	it("takes the first occurrence when the key is repeated", () => {
		expect(parse("---\nDropdownClass: Book\nDropdownClass: Article\n---")).toBe("Book");
	});
});
