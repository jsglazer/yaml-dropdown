import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	CURSOR_TRIGGER_DELAY_MS,
	Scheduler,
	createTrailingDebouncer,
} from "../src/core/debounce";

/** Stands in for the production scheduler, backed here by fake timers. */
const fakeTimerScheduler: Scheduler = {
	defer: (callback, delayMs) => setTimeout(callback, delayMs) as unknown as number,
	clear: (handle) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>),
};

describe("createTrailingDebouncer", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("uses a 40 ms cursor-move delay", () => {
		expect(CURSOR_TRIGGER_DELAY_MS).toBe(40);
	});

	it("does not fire before the delay elapses", () => {
		const debouncer = createTrailingDebouncer(fakeTimerScheduler, 40);
		const spy = vi.fn();
		debouncer.schedule(spy);
		vi.advanceTimersByTime(39);
		expect(spy).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it("is trailing: rapid scheduling fires once, with the last callback", () => {
		const debouncer = createTrailingDebouncer(fakeTimerScheduler, 40);
		const first = vi.fn();
		const last = vi.fn();
		debouncer.schedule(first);
		vi.advanceTimersByTime(20);
		debouncer.schedule(first);
		vi.advanceTimersByTime(20);
		debouncer.schedule(last);
		vi.advanceTimersByTime(40);
		expect(first).not.toHaveBeenCalled();
		expect(last).toHaveBeenCalledTimes(1);
	});

	it("fires again for a later, separate burst", () => {
		const debouncer = createTrailingDebouncer(fakeTimerScheduler, 40);
		const spy = vi.fn();
		debouncer.schedule(spy);
		vi.advanceTimersByTime(40);
		debouncer.schedule(spy);
		vi.advanceTimersByTime(40);
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it("cancel() prevents a pending callback from firing", () => {
		const debouncer = createTrailingDebouncer(fakeTimerScheduler, 40);
		const spy = vi.fn();
		debouncer.schedule(spy);
		vi.advanceTimersByTime(20);
		debouncer.cancel();
		vi.advanceTimersByTime(100);
		expect(spy).not.toHaveBeenCalled();
	});

	it("cancel() is safe when nothing is pending", () => {
		const debouncer = createTrailingDebouncer(fakeTimerScheduler, 40);
		expect(() => {
			debouncer.cancel();
			debouncer.cancel();
		}).not.toThrow();
	});

	it("clears the previous handle rather than leaking timers", () => {
		const cleared: number[] = [];
		let nextHandle = 0;
		const counting: Scheduler = {
			defer: (callback, delayMs) => {
				nextHandle += 1;
				setTimeout(callback, delayMs);
				return nextHandle;
			},
			clear: (handle) => cleared.push(handle),
		};
		const debouncer = createTrailingDebouncer(counting, 40);
		debouncer.schedule(() => undefined);
		debouncer.schedule(() => undefined);
		debouncer.schedule(() => undefined);
		expect(cleared).toEqual([1, 2]);
	});
});
