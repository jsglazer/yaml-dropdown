import type { Scheduler } from "./core/debounce";

/**
 * Default scheduler for the cursor-move debouncer, backed by the platform timer.
 * It lives in the shell rather than in `src/core/` so core never names a global
 * timer; tests inject a fake scheduler instead.
 */
export const systemScheduler: Scheduler = {
	defer: (callback: () => void, delayMs: number): number => window.setTimeout(callback, delayMs),
	clear: (handle: number): void => window.clearTimeout(handle),
};
