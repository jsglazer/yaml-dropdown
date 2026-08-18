import { describe, expect, it } from "vitest";

import { compileFolderPattern, scopeMatches } from "../src/core/scope";

describe("compileFolderPattern", () => {
	it("compiles a valid pattern", () => {
		const result = compileFolderPattern("^Projects/");
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.regex.test("Projects/Alpha")).toBe(true);
	});

	it("compiles an empty pattern", () => {
		expect(compileFolderPattern("").ok).toBe(true);
	});

	it("reports an invalid pattern instead of throwing", () => {
		expect(() => compileFolderPattern("([")).not.toThrow();
		const result = compileFolderPattern("([");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
	});

	it("reports every malformed pattern shape without throwing", () => {
		for (const pattern of ["([", "a{2,1}", "(?<", "*", "\\"]) {
			expect(() => compileFolderPattern(pattern)).not.toThrow();
			expect(compileFolderPattern(pattern).ok).toBe(false);
		}
	});

	it("compiles without flags, so matching is case-sensitive and stateless", () => {
		const result = compileFolderPattern("projects");
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.regex.flags).toBe("");
		expect(result.regex.test("Projects")).toBe(false);
		// A global flag would make repeated .test() calls stateful.
		expect(result.regex.test("projects")).toBe(true);
		expect(result.regex.test("projects")).toBe(true);
	});
});

describe("scopeMatches", () => {
	const target = {
		filePath: "Projects/Alpha/Roadmap.md",
		folderPath: "Projects/Alpha",
		className: "Book",
	};

	it("matches a folder scope by regex", () => {
		expect(scopeMatches({ type: "folder", pattern: "^Projects" }, target)).toBe(true);
		expect(scopeMatches({ type: "folder", pattern: "^Archive" }, target)).toBe(false);
	});

	it("skips a folder scope whose regex does not compile", () => {
		expect(scopeMatches({ type: "folder", pattern: "([" }, target)).toBe(false);
	});

	it("matches a file scope only on the exact path", () => {
		expect(scopeMatches({ type: "file", pattern: target.filePath }, target)).toBe(true);
		expect(scopeMatches({ type: "file", pattern: "Roadmap.md" }, target)).toBe(false);
	});

	it("matches a class scope only on the exact class", () => {
		expect(scopeMatches({ type: "class", pattern: "Book" }, target)).toBe(true);
		expect(scopeMatches({ type: "class", pattern: "Book" }, { ...target, className: null })).toBe(
			false,
		);
	});
});
