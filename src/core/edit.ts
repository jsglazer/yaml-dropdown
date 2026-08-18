/**
 * Accepting a suggestion replaces the range from the value-start offset to end of
 * line with the chosen value verbatim: no quoting, escaping, type coercion, or
 * YAML validation, and no other line in the document is touched.
 */

export interface Replacement {
	readonly from: number;
	readonly to: number;
	readonly text: string;
}

export function buildReplacement(line: string, valueStart: number, value: string): Replacement {
	const from = Math.min(Math.max(valueStart, 0), line.length);
	return { from, to: line.length, text: value };
}
