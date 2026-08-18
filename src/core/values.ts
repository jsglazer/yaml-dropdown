/**
 * Conversion between the comma-separated text the user types in the settings tab and
 * the `values[]` array that is persisted. The raw comma string is never stored.
 */

/**
 * Split on commas, trim each entry, drop empties, and dedupe preserving
 * first-occurrence order.
 */
export function parseValueList(raw: string): string[] {
	const seen: string[] = [];
	for (const part of raw.split(",")) {
		const value = part.trim();
		if (value.length === 0) continue;
		if (seen.indexOf(value) !== -1) continue;
		seen.push(value);
	}
	return seen;
}

/** Render a persisted value list back into the settings text field. Display only. */
export function formatValueList(values: readonly string[]): string {
	return values.join(", ");
}
