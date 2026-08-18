import { describe, expect, it } from "vitest";

import { buildReplacement } from "../src/core/edit";

describe("buildReplacement", () => {
	it("replaces from value-start to end of line", () => {
		expect(buildReplacement("Status: Ope", 8, "Open")).toEqual({
			from: 8,
			to: 11,
			text: "Open",
		});
	});

	it("replaces an existing value entirely, not just the query", () => {
		expect(buildReplacement("Status: In progress", 8, "Done")).toEqual({
			from: 8,
			to: 19,
			text: "Done",
		});
	});

	it("fills an empty value", () => {
		expect(buildReplacement("Status: ", 8, "Open")).toEqual({ from: 8, to: 8, text: "Open" });
	});

	it("inserts the value verbatim with no quoting or escaping", () => {
		expect(buildReplacement("Status: ", 8, 'a: "b", [c]').text).toBe('a: "b", [c]');
		expect(buildReplacement("Status: ", 8, "  spaced  ").text).toBe("  spaced  ");
	});

	it("clamps a value-start beyond end of line", () => {
		expect(buildReplacement("Status: ", 99, "Open")).toEqual({ from: 8, to: 8, text: "Open" });
	});
});
