import { describe, expect, it } from "vitest";

import { formatValueList, parseValueList } from "../src/core/values";

describe("parseValueList", () => {
	it("splits on commas and trims each entry", () => {
		expect(parseValueList("Open, In progress ,Done")).toEqual(["Open", "In progress", "Done"]);
	});

	it("drops empty entries", () => {
		expect(parseValueList("Open,,Done,")).toEqual(["Open", "Done"]);
		expect(parseValueList(" , , ")).toEqual([]);
		expect(parseValueList("")).toEqual([]);
	});

	it("dedupes preserving first-occurrence order", () => {
		expect(parseValueList("B, A, B, C, A")).toEqual(["B", "A", "C"]);
	});

	it("dedupes case-sensitively", () => {
		expect(parseValueList("Open, open")).toEqual(["Open", "open"]);
	});

	it("keeps internal spaces", () => {
		expect(parseValueList("In progress, Not started")).toEqual(["In progress", "Not started"]);
	});
});

describe("formatValueList", () => {
	it("round-trips a parsed list", () => {
		const parsed = parseValueList("Open, In progress, Done");
		expect(formatValueList(parsed)).toBe("Open, In progress, Done");
		expect(parseValueList(formatValueList(parsed))).toEqual(parsed);
	});

	it("renders an empty list as an empty string", () => {
		expect(formatValueList([])).toBe("");
	});
});
