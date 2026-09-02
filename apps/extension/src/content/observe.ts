export interface DebounceScheduler {
	set(callback: () => void, delayMs: number): number;
	clear(handle: number): void;
}

export interface DebouncedTask {
	schedule(): void;
	cancel(): void;
}

export function createDebouncedTask(
	task: () => void,
	delayMs: number,
	scheduler: DebounceScheduler
): DebouncedTask {
	let pendingHandle: number | undefined;

	return {
		schedule() {
			if (pendingHandle !== undefined) scheduler.clear(pendingHandle);
			pendingHandle = scheduler.set(() => {
				pendingHandle = undefined;
				task();
			}, delayMs);
		},
		cancel() {
			if (pendingHandle === undefined) return;
			scheduler.clear(pendingHandle);
			pendingHandle = undefined;
		}
	};
}
