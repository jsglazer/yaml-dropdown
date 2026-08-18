import { describe, expect, it } from "vitest";

import { sameSite, shouldRetrigger } from "../src/core/reentry";

const site = (line: number, valueStart: number) => ({ line, valueStart });

describe("sameSite", () => {
	it("is true for identical line and value-start", () => {
		expect(sameSite(site(3, 8), site(3, 8))).toBe(true);
	});

	it("is false for a different line or value-start", () => {
		expect(sameSite(site(3, 8), site(4, 8))).toBe(false);
		expect(sameSite(site(3, 8), site(3, 9))).toBe(false);
	});

	it("is false when either side is null", () => {
		expect(sameSite(null, site(3, 8))).toBe(false);
		expect(sameSite(site(3, 8), null)).toBe(false);
		expect(sameSite(null, null)).toBe(false);
	});
});

describe("shouldRetrigger", () => {
	it("triggers when the popup is closed", () => {
		expect(shouldRetrigger(false, null, site(3, 8))).toBe(true);
	});

	it("triggers when the popup is closed even at the same site", () => {
		expect(shouldRetrigger(false, site(3, 8), site(3, 8))).toBe(true);
	});

	it("does not re-trigger while open at the same site", () => {
		// Moving the cursor within the value must not fight the open popup.
		expect(shouldRetrigger(true, site(3, 8), site(3, 8))).toBe(false);
	});

	it("re-triggers when the cursor moves to another key on another line", () => {
		expect(shouldRetrigger(true, site(3, 8), site(4, 6))).toBe(true);
	});

	it("re-triggers when the value-start offset changes on the same line", () => {
		expect(shouldRetrigger(true, site(3, 8), site(3, 10))).toBe(true);
	});

	it("re-triggers when open with no known site", () => {
		expect(shouldRetrigger(true, null, site(3, 8))).toBe(true);
	});
});
