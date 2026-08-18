/**
 * Re-entry guard for the cursor-move trigger. If the popup is already open for the
 * same line and value-start offset, moving within that value must not re-trigger —
 * that is what would otherwise fight the cursor or loop.
 */

export interface TriggerSite {
	readonly line: number;
	readonly valueStart: number;
}

export function sameSite(a: TriggerSite | null, b: TriggerSite | null): boolean {
	if (a === null || b === null) return false;
	return a.line === b.line && a.valueStart === b.valueStart;
}

export function shouldRetrigger(
	isOpen: boolean,
	openSite: TriggerSite | null,
	nextSite: TriggerSite,
): boolean {
	if (!isOpen) return true;
	return !sameSite(openSite, nextSite);
}
