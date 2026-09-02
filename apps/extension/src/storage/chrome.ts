import type { KeyValueStorage } from '../../../../packages/timetable/src/storage.ts';

export interface ChromeStorageArea {
	get(key: string): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(key: string): Promise<void>;
}

export function createChromeStorage(area: ChromeStorageArea): KeyValueStorage {
	return {
		async get<T>(key: string): Promise<T | undefined> {
			const values = await area.get(key);
			return values[key] as T | undefined;
		},
		async set<T>(key: string, value: T): Promise<void> {
			await area.set({ [key]: value });
		},
		async remove(key: string): Promise<void> {
			await area.remove(key);
		}
	};
}
