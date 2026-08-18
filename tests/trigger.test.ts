import { describe, expect, it } from "vitest";

import { detectTriggerPosition } from "../src/core/trigger";

describe("detectTriggerPosition", () => {
	describe("spacing after the colon", () => {
		it("triggers on exactly one space", () => {
			// "Status: Open" — value starts at ch 8.
			const match = detectTriggerPosition("Status: Open", 8);
			expect(match).toEqual({ key: "Status", valueStart: 8, query: "" });
		});

		it("does not trigger with zero spaces", () => {
			expect(detectTriggerPosition("Status:Open", 7)).toBeNull();
			expect(detectTriggerPosition("Status:Open", 11)).toBeNull();
		});

		it("does not trigger with two spaces", () => {
			expect(detectTriggerPosition("Status:  Open", 9)).toBeNull();
		});

		it("does not trigger with three spaces", () => {
			expect(detectTriggerPosition("Status:   Open", 10)).toBeNull();
		});

		it("triggers on a bare key with one trailing space", () => {
			expect(detectTriggerPosition("Status: ", 8)).toEqual({
				key: "Status",
				valueStart: 8,
				query: "",
			});
		});

		it("does not trigger on a bare key with no trailing space", () => {
			expect(detectTriggerPosition("Status:", 7)).toBeNull();
		});
	});

	describe("cursor placement", () => {
		it("does not trigger before the value-start offset", () => {
			expect(detectTriggerPosition("Status: Open", 7)).toBeNull();
			expect(detectTriggerPosition("Status: Open", 0)).toBeNull();
		});

		it("triggers at the value-start offset", () => {
			expect(detectTriggerPosition("Status: Open", 8)?.query).toBe("");
		});

		it("triggers after the value-start offset", () => {
			expect(detectTriggerPosition("Status: Open", 10)?.query).toBe("Op");
		});

		it("triggers at end of line", () => {
			expect(detectTriggerPosition("Status: Open", 12)?.query).toBe("Open");
		});

		it("does not trigger past end of line", () => {
			expect(detectTriggerPosition("Status: Open", 13)).toBeNull();
		});
	});

	describe("key extraction", () => {
		it("extracts the key verbatim, preserving case", () => {
			expect(detectTriggerPosition("PublishStatus: Open", 15)?.key).toBe("PublishStatus");
		});

		it("allows internal spaces in a key", () => {
			expect(detectTriggerPosition("Due Date: 2026", 10)?.key).toBe("Due Date");
		});

		it("rejects an indented (nested) key", () => {
			expect(detectTriggerPosition("  Status: Open", 10)).toBeNull();
		});

		it("rejects a list item", () => {
			expect(detectTriggerPosition("- Status: Open", 10)).toBeNull();
		});

		it("rejects a comment line", () => {
			expect(detectTriggerPosition("# Status: Open", 10)).toBeNull();
		});

		it("rejects an empty key", () => {
			expect(detectTriggerPosition(": Open", 2)).toBeNull();
		});

		it("rejects a line with no colon", () => {
			expect(detectTriggerPosition("Status Open", 7)).toBeNull();
			expect(detectTriggerPosition("---", 3)).toBeNull();
			expect(detectTriggerPosition("", 0)).toBeNull();
		});
	});

	describe("query extraction", () => {
		it("uses the first colon when the value contains one", () => {
			const match = detectTriggerPosition("Link: https://example.com", 11);
			expect(match).toEqual({ key: "Link", valueStart: 6, query: "https" });
		});

		it("returns the literal text without trimming", () => {
			expect(detectTriggerPosition("Status: op en", 13)?.query).toBe("op en");
		});

		it("preserves query case", () => {
			expect(detectTriggerPosition("Status: OpEn", 12)?.query).toBe("OpEn");
		});
	});
});
