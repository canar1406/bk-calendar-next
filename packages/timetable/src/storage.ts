import {
	diffSnapshots,
	type SourceKind,
	type TimetableDiff,
	type TimetableSnapshot
} from './index.ts';

const STORAGE_KEY = 'bkalendar-next:profiles';
const CURRENT_SCHEMA_VERSION = 1;

export interface SyncProfile {
	schemaVersion: 1;
	profileId: string;
	sourceKind: SourceKind;
	semester: number;
	calendarName: string;
	calendarId?: string;
	acceptedSnapshot?: TimetableSnapshot;
	pendingSnapshot?: TimetableSnapshot;
	lastCheckedAt?: string;
	lastSyncedAt?: string;
}

export interface KeyValueStorage {
	get<T>(key: string): Promise<T | undefined>;
	set<T>(key: string, value: T): Promise<void>;
	remove(key: string): Promise<void>;
}

export interface ProfileStore {
	get(profileId: string): Promise<SyncProfile | undefined>;
	list(): Promise<SyncProfile[]>;
	save(profile: SyncProfile): Promise<void>;
	remove(profileId: string): Promise<void>;
	clear(): Promise<void>;
}

export interface StagedSnapshot {
	profileId: string;
	profile: SyncProfile;
	diff: TimetableDiff;
}

export function createProfileStore(storage: KeyValueStorage): ProfileStore {
	async function list(): Promise<SyncProfile[]> {
		const values = (await storage.get<unknown>(STORAGE_KEY)) ?? [];
		if (!Array.isArray(values))
			throw new Error('Dữ liệu BKalendar đã hỏng. Hãy xuất backup rồi đặt lại ứng dụng.');
		const profiles = values.map(validateProfile);
		return profiles.sort((a, b) => a.profileId.localeCompare(b.profileId));
	}

	return {
		async get(profileId) {
			return (await list()).find((profile) => profile.profileId === profileId);
		},
		list,
		async save(profile) {
			validateProfile(profile);
			const profiles = await list();
			const index = profiles.findIndex((item) => item.profileId === profile.profileId);
			if (index >= 0) profiles[index] = sanitizeProfile(profile);
			else profiles.push(sanitizeProfile(profile));
			await storage.set(
				STORAGE_KEY,
				profiles.sort((a, b) => a.profileId.localeCompare(b.profileId))
			);
		},
		async remove(profileId) {
			const profiles = (await list()).filter((profile) => profile.profileId !== profileId);
			if (profiles.length === 0) await storage.remove(STORAGE_KEY);
			else await storage.set(STORAGE_KEY, profiles);
		},
		async clear() {
			await storage.remove(STORAGE_KEY);
		}
	};
}

export function createBrowserStorage(storage: Storage): KeyValueStorage {
	return {
		async get<T>(key: string): Promise<T | undefined> {
			const value = storage.getItem(key);
			return value === null ? undefined : (JSON.parse(value) as T);
		},
		async set<T>(key: string, value: T): Promise<void> {
			storage.setItem(key, JSON.stringify(value));
		},
		async remove(key: string): Promise<void> {
			storage.removeItem(key);
		}
	};
}

export async function stageSnapshot(
	store: ProfileStore,
	snapshot: TimetableSnapshot
): Promise<StagedSnapshot> {
	const profileId = `${snapshot.sourceKind}:${snapshot.semester}`;
	const existing = await store.get(profileId);
	const profile: SyncProfile = {
		...(existing ?? {
			schemaVersion: 1,
			profileId,
			sourceKind: snapshot.sourceKind,
			semester: snapshot.semester,
			calendarName: `BKalendar • HK ${snapshot.semester}`
		}),
		schemaVersion: 1,
		profileId,
		sourceKind: snapshot.sourceKind,
		semester: snapshot.semester,
		pendingSnapshot: snapshot,
		lastCheckedAt: snapshot.capturedAt
	};
	await store.save(profile);

	return {
		profileId,
		profile,
		diff: diffSnapshots(existing?.acceptedSnapshot, snapshot)
	};
}

function validateProfile(value: unknown): SyncProfile {
	if (!value || typeof value !== 'object') throw new Error('Profile BKalendar không hợp lệ.');
	const profile = value as Partial<SyncProfile> & { schemaVersion?: number };
	if (profile.schemaVersion !== CURRENT_SCHEMA_VERSION) {
		throw new Error(`Không hỗ trợ phiên bản dữ liệu BKalendar ${String(profile.schemaVersion)}.`);
	}
	if (
		typeof profile.profileId !== 'string' ||
		typeof profile.semester !== 'number' ||
		typeof profile.sourceKind !== 'string' ||
		typeof profile.calendarName !== 'string'
	) {
		throw new Error('Profile BKalendar thiếu thông tin bắt buộc.');
	}
	return sanitizeProfile(profile as SyncProfile);
}

function sanitizeProfile(profile: SyncProfile): SyncProfile {
	const clone = structuredClone(profile) as SyncProfile & Record<string, unknown>;
	delete clone.accessToken;
	delete clone.refreshToken;
	return clone;
}
