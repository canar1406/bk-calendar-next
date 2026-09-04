import type { ExtensionTokenStore } from './google-auth.ts';

export interface TokenStorageArea {
	get(key: string): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(key: string): Promise<void>;
}

export function selectTokenStorageArea(
	sessionArea: TokenStorageArea | undefined,
	fallbackArea: TokenStorageArea
): TokenStorageArea {
	return sessionArea ?? fallbackArea;
}

export function createMemoryTokenStorageArea(): TokenStorageArea {
	const values = new Map<string, unknown>();
	return {
		async get(key) {
			return { [key]: values.get(key) };
		},
		async set(items) {
			for (const [key, value] of Object.entries(items)) values.set(key, value);
		},
		async remove(key) {
			values.delete(key);
		}
	};
}

export function createGoogleTokenStore(
	area: TokenStorageArea,
	key = 'bkalendar-next:google-token-cache'
): ExtensionTokenStore {
	return {
		async read() {
			const stored = await area.get(key);
			const value = stored[key];
			if (!value || typeof value !== 'object') return undefined;
			const candidate = value as Record<string, unknown>;
			if (typeof candidate.token !== 'string' || typeof candidate.expiresAt !== 'number') {
				return undefined;
			}
			return { token: candidate.token, expiresAt: candidate.expiresAt };
		},
		async write(value) {
			await area.set({ [key]: value });
		},
		async remove() {
			await area.remove(key);
		}
	};
}
