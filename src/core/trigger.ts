/**
 * Decides whether a single line + cursor column is a dropdown trigger site.
 *
 * The rule is exact: a frontmatter key, a colon, and *exactly one* space. Zero
 * spaces or two-or-more spaces never trigger, and the plugin never inserts a
 * space on the user's behalf.
 */

export interface TriggerMatch {
	/** The frontmatter key, verbatim — case folding is the matcher's job, not ours. */
	readonly key: string;
	/** Column of the first value character, i.e. one past the single space. */
	readonly valueStart: number;
	/** Literal text between `valueStart` and the cursor. Never trimmed. */
	readonly query: string;
}

export function detectTriggerPosition(line: string, cursorCh: number): TriggerMatch | null {
	const colon = line.indexOf(":");
	if (colon <= 0) return null;

	const key = line.slice(0, colon);
	if (!isFrontmatterKey(key)) return null;

	if (line.charAt(colon + 1) !== " ") return null;
	if (line.charAt(colon + 2) === " ") return null;

	const valueStart = colon + 2;
	if (cursorCh < valueStart || cursorCh > line.length) return null;

	return { key, valueStart, query: line.slice(valueStart, cursorCh) };
}

/**
 * A top-level mapping key: non-empty, unindented, and not a list item or comment.
 * Nested keys are indented and so are rejected by the whitespace check.
 */
function isFrontmatterKey(key: string): boolean {
	if (key.length === 0) return false;
	if (key !== key.trim()) return false;
	const first = key.charAt(0);
	return first !== "-" && first !== "#";
}
