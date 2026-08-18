/**
 * Suggestion filtering. Always case-insensitive substring matching, regardless of
 * the `caseInsensitiveKeys` setting, which governs key matching only. Results keep
 * the order the values were defined in — never sorted, never fuzzy-ranked.
 */
export function filterValues(values: readonly string[], query: string): string[] {
	if (query.length === 0) return values.slice();
	const needle = query.toLowerCase();
	return values.filter((value) => value.toLowerCase().indexOf(needle) !== -1);
}
