/**
 * Trailing debouncer for the cursor-move trigger path. The scheduler is injected
 * so tests drive it with fake timers; core never names a global timer at all.
 *
 * The keystroke path is deliberately not routed through here.
 */

export const CURSOR_TRIGGER_DELAY_MS = 40;

/**
 * The timer capability core is allowed to use. The production implementation in
 * `src/scheduler.ts` backs `defer`/`clear` with the platform timer.
 */
export interface Scheduler {
	defer(callback: () => void, delayMs: number): number;
	clear(handle: number): void;
}

export interface Debouncer {
	schedule(callback: () => void): void;
	cancel(): void;
}

export function createTrailingDebouncer(scheduler: Scheduler, delayMs: number): Debouncer {
	let handle: number | null = null;

	return {
		schedule(callback: () => void): void {
			if (handle !== null) scheduler.clear(handle);
			handle = scheduler.defer(() => {
				handle = null;
				callback();
			}, delayMs);
		},
		cancel(): void {
			if (handle === null) return;
			scheduler.clear(handle);
			handle = null;
		},
	};
}
