/**
 * Synchronous frontmatter detection and `DropdownClass` extraction, driven straight
 * from editor text so nothing depends on the asynchronous metadata cache.
 */

/** Frontmatter is only looked for inside the first 100 lines of the document. */
export const MAX_FRONTMATTER_SCAN_LINES = 100;

/** The class key is a fixed literal — it is not user-configurable in v1. */
export const CLASS_KEY = "DropdownClass";

export interface FrontmatterRange {
	/** Always 0 — the opening fence must be the very first line. */
	readonly startLine: number;
	/** Line index of the closing fence. */
	readonly endLine: number;
}

const OPEN_FENCE = "---";
const CLOSE_FENCES: readonly string[] = ["---", "..."];

/**
 * Requires an opening `---` on line 0 with nothing before it, then scans at most
 * the first `MAX_FRONTMATTER_SCAN_LINES` lines for a closing `---` or `...`.
 * If no closing fence is found inside that window the document is treated as
 * having no frontmatter at all.
 */
export function detectFrontmatter(lines: readonly string[]): FrontmatterRange | null {
	if (lines.length === 0) return null;
	if (trimEnd(lines[0]) !== OPEN_FENCE) return null;

	const limit = Math.min(lines.length, MAX_FRONTMATTER_SCAN_LINES);
	for (let i = 1; i < limit; i++) {
		if (CLOSE_FENCES.indexOf(trimEnd(lines[i])) !== -1) {
			return { startLine: 0, endLine: i };
		}
	}
	return null;
}

/** True only for content lines — both fences are excluded. */
export function isInsideFrontmatter(range: FrontmatterRange, line: number): boolean {
	return line > range.startLine && line < range.endLine;
}

/**
 * Read `DropdownClass` as a single scalar string. YAML arrays, inline lists, and
 * comma-separated class values are ignored in v1 and yield `null`.
 */
export function parseDropdownClass(
	lines: readonly string[],
	range: FrontmatterRange,
): string | null {
	for (let i = range.startLine + 1; i < range.endLine; i++) {
		const line = lines[i];
		if (line.slice(0, CLASS_KEY.length) !== CLASS_KEY) continue;
		if (line.charAt(CLASS_KEY.length) !== ":") continue;
		return parseScalar(line.slice(CLASS_KEY.length + 1));
	}
	return null;
}

function parseScalar(raw: string): string | null {
	const value = raw.trim();
	if (value.length === 0) return null;
	// A block list continues on the next line; an inline list opens with `[`.
	if (value.charAt(0) === "[" || value.charAt(0) === "-") return null;

	const unquoted = stripQuotes(value);
	// An explicitly quoted scalar is unambiguous, so a comma inside it is part of the value.
	if (unquoted !== value) return unquoted;
	if (value.indexOf(",") !== -1) return null;
	return value;
}

function stripQuotes(value: string): string {
	if (value.length < 2) return value;
	const first = value.charAt(0);
	if (first !== '"' && first !== "'") return value;
	if (value.charAt(value.length - 1) !== first) return value;
	return value.slice(1, value.length - 1);
}

/** `String.prototype.trimEnd` is ES2019; this build targets ES2018. */
function trimEnd(value: string): string {
	return value.replace(/\s+$/, "");
}
