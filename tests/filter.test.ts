import { describe, expect, it } from "vitest";

import { filterValues } from "../src/core/filter";

const VALUES = ["Open", "In progress", "Done", "OPEN QUESTION"];

describe("filterValues", () => {
	it("returns the full list for an empty query", () => {
		expect(filterValues(VALUES, "")).toEqual(VALUES);
	});

	it("returns a copy, not the original array", () => {
		const result = filterValues(VALUES, "");
		expect(result).not.toBe(VALUES);
	});

	it("matches case-insensitively", () => {
		expect(filterValues(VALUES, "open")).toEqual(["Open", "OPEN QUESTION"]);
		expect(filterValues(VALUES, "OPEN")).toEqual(["Open", "OPEN QUESTION"]);
		expect(filterValues(VALUES, "OpEn")).toEqual(["Open", "OPEN QUESTION"]);
	});

	it("matches a substring anywhere in the value", () => {
		expect(filterValues(VALUES, "progress")).toEqual(["In progress"]);
		expect(filterValues(VALUES, "on")).toEqual(["Done", "OPEN QUESTION"]);
	});

	it("preserves definition order and never sorts or ranks", () => {
		expect(filterValues(["Zebra", "Apple", "Zap"], "z")).toEqual(["Zebra", "Zap"]);
	});

	it("returns an empty list when nothing matches", () => {
		expect(filterValues(VALUES, "nothing")).toEqual([]);
	});

	it("does not fuzzy-match non-contiguous characters", () => {
		expect(filterValues(["Open"], "opn")).toEqual([]);
	});

	it("treats a query with spaces literally", () => {
		expect(filterValues(VALUES, "in pro")).toEqual(["In progress"]);
	});

	it("handles an empty value list", () => {
		expect(filterValues([], "x")).toEqual([]);
		expect(filterValues([], "")).toEqual([]);
	});
});
