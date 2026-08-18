import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Machine-checkable guards for the build's architectural constraints. These read
 * source files rather than exercising behaviour, so they fail loudly the moment a
 * later change reintroduces a dependency the constraints forbid.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SRC = join(HERE, "..", "src");
const CORE = join(SRC, "core");

function tsFiles(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) found.push(...tsFiles(full));
		else if (entry.endsWith(".ts")) found.push(full);
	}
	return found;
}

/**
 * Source with comments removed, so these guards judge code rather than prose —
 * a doc comment mentioning "the document" is not a DOM access.
 */
function read(file: string): string {
	return readFileSync(file, "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("src/core purity", () => {
	const files = tsFiles(CORE);

	it("has core modules to check", () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it("imports nothing from obsidian", () => {
		for (const file of files) {
			expect(read(file), file).not.toMatch(/from\s+["']obsidian["']/);
			expect(read(file), file).not.toMatch(/require\(\s*["']obsidian["']\s*\)/);
		}
	});

	it("imports nothing from CodeMirror", () => {
		for (const file of files) {
			expect(read(file), file).not.toMatch(/from\s+["']@codemirror\//);
			expect(read(file), file).not.toMatch(/from\s+["']@lezer\//);
		}
	});

	it("imports nothing outside src/core", () => {
		for (const file of files) {
			const imports = read(file).match(/from\s+["']([^"']+)["']/g) ?? [];
			for (const statement of imports) {
				expect(statement, file).toMatch(/from\s+["']\.\/[^"']+["']/);
			}
		}
	});

	it("touches no DOM, timer, or App globals", () => {
		for (const file of files) {
			const source = read(file);
			for (const forbidden of [
				/\bdocument\./,
				/\bwindow\./,
				/\bsetTimeout\(/,
				/\bsetInterval\(/,
				/\bfetch\(/,
				/\bapp\.workspace\b/,
			]) {
				expect(source, `${file} :: ${String(forbidden)}`).not.toMatch(forbidden);
			}
		}
	});

	it("performs no I/O and reads no clock or randomness", () => {
		for (const file of files) {
			const source = read(file);
			for (const forbidden of [/Date\.now/, /new Date\(/, /Math\.random/, /localStorage/]) {
				expect(source, `${file} :: ${String(forbidden)}`).not.toMatch(forbidden);
			}
		}
	});
});

describe("mobile safety", () => {
	const files = tsFiles(SRC);

	it("uses no Node, Electron, or CommonJS runtime APIs anywhere in src/", () => {
		for (const file of files) {
			const source = read(file);
			for (const forbidden of [
				/from\s+["']node:/,
				/from\s+["'](fs|path|os|child_process|electron)["']/,
				/\brequire\(/,
				/\bprocess\.(env|platform|cwd)\b/,
				/\b__dirname\b/,
			]) {
				expect(source, `${file} :: ${String(forbidden)}`).not.toMatch(forbidden);
			}
		}
	});

	it("ships as mobile-capable", () => {
		const manifest = JSON.parse(read(join(HERE, "..", "manifest.json")));
		expect(manifest.isDesktopOnly).toBe(false);
	});
});

describe("undocumented internals are confined to one adapter", () => {
	const outsideAdapters = tsFiles(SRC).filter((file) => !file.includes("adapters"));

	it("only the adapter reaches for the editor-suggest manager", () => {
		for (const file of outsideAdapters) {
			expect(read(file), file).not.toMatch(/editorSuggest/);
		}
	});

	it("no module outside the adapter casts the workspace to reach an internal", () => {
		for (const file of outsideAdapters) {
			expect(read(file), file).not.toMatch(/workspace\s+as\s+unknown/);
		}
	});
});

describe("no console logging in committed code", () => {
	it("src/ contains no console calls", () => {
		for (const file of tsFiles(SRC)) {
			expect(read(file), file).not.toMatch(/\bconsole\.\w+\(/);
		}
	});
});
