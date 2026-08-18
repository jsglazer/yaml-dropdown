import { describe, expect, it } from "vitest";

import { parentFolderPath } from "../src/core/paths";

describe("parentFolderPath", () => {
	it("returns the parent folder with no trailing slash", () => {
		expect(parentFolderPath("Projects/Alpha/Roadmap.md")).toBe("Projects/Alpha");
	});

	it("returns the empty string at vault root", () => {
		expect(parentFolderPath("Roadmap.md")).toBe("");
	});

	it("handles a single-level folder", () => {
		expect(parentFolderPath("Projects/Roadmap.md")).toBe("Projects");
	});

	it("never emits a leading slash", () => {
		expect(parentFolderPath("Projects/Alpha/Roadmap.md").startsWith("/")).toBe(false);
	});
});
