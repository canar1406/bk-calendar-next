import { createPresentationFingerprint, type ManagedEvent } from '../../timetable/src/index.ts';
export { COURSE_ICONS } from './emoji-catalog.ts';

export type CourseColorMode = 'mono' | 'course';

export interface GoogleEventColor {
	id: string;
	name: string;
	background: string;
	foreground: string;
}

export interface CourseIcon {
	value: string;
	label: string;
	category: string;
	keywords?: string;
}

export interface CourseColorPalette {
	id: string;
	name: string;
	description: string;
	colorIds: string[];
}

export interface CourseAppearanceSummary {
	course: string;
	courseCode: string;
	title: string;
	colorId: string;
	colorName: string;
	background: string;
	foreground: string;
	icon: string;
}

export interface CourseColorPreferences {
	schemaVersion: 1;
	mode: CourseColorMode;
	seed: number;
	monoColorId: string;
	overrides: Record<string, string>;
	icons: Record<string, string>;
}

export interface CourseColorStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export const COURSE_APPEARANCE_TRANSFER_TYPE = 'bkalendar:course-appearance';
export const COURSE_APPEARANCE_TRANSFER_VERSION = 1;

export interface CourseAppearanceTransferMessage {
	source: 'bkalendar-web';
	type: typeof COURSE_APPEARANCE_TRANSFER_TYPE;
	version: typeof COURSE_APPEARANCE_TRANSFER_VERSION;
	profileId: string;
	preferences: CourseColorPreferences;
}

export const GOOGLE_EVENT_COLORS: GoogleEventColor[] = [
	{ id: '1', name: 'Oải hương', background: '#7986cb', foreground: '#ffffff' },
	{ id: '2', name: 'Xanh lá', background: '#33b679', foreground: '#ffffff' },
	{ id: '3', name: 'Nho tím', background: '#8e24aa', foreground: '#ffffff' },
	{ id: '4', name: 'San hô', background: '#e67c73', foreground: '#17202a' },
	{ id: '5', name: 'Vàng', background: '#f6bf26', foreground: '#17202a' },
	{ id: '6', name: 'Cam', background: '#f4511e', foreground: '#ffffff' },
	{ id: '7', name: 'Xanh trời', background: '#039be5', foreground: '#ffffff' },
	{ id: '8', name: 'Than chì', background: '#616161', foreground: '#ffffff' },
	{ id: '9', name: 'Việt quất', background: '#3f51b5', foreground: '#ffffff' },
	{ id: '10', name: 'Húng quế', background: '#0b8043', foreground: '#ffffff' },
	{ id: '11', name: 'Cà chua', background: '#d50000', foreground: '#ffffff' }
];

export const COURSE_COLOR_PALETTES: CourseColorPalette[] = [
	{
		id: 'campus',
		name: 'Campus',
		description: 'Cân bằng, dễ phân biệt',
		colorIds: ['7', '2', '5', '4', '3', '9', '10', '6', '1', '11', '8']
	},
	{
		id: 'ocean',
		name: 'Đại dương',
		description: 'Xanh lam và xanh lá trước',
		colorIds: ['7', '9', '1', '2', '10', '3', '5', '4', '6', '8', '11']
	},
	{
		id: 'sunset',
		name: 'Hoàng hôn',
		description: 'Cam, đỏ và vàng nổi bật',
		colorIds: ['6', '4', '5', '11', '3', '1', '7', '2', '9', '10', '8']
	},
	{
		id: 'garden',
		name: 'Khu vườn',
		description: 'Xanh dịu xen màu nhấn',
		colorIds: ['2', '10', '7', '5', '1', '4', '9', '3', '6', '8', '11']
	},
	{
		id: 'berry',
		name: 'Berry',
		description: 'Tím, đỏ và xanh lạnh',
		colorIds: ['3', '9', '1', '4', '11', '7', '2', '5', '10', '6', '8']
	},
	{
		id: 'contrast',
		name: 'Tương phản',
		description: 'Tách môn rõ nhất',
		colorIds: ['11', '7', '5', '3', '2', '6', '9', '4', '10', '1', '8']
	},
	{
		id: 'pastel',
		name: 'Dịu mắt',
		description: 'Ưu tiên màu nhẹ trước',
		colorIds: ['1', '4', '2', '5', '7', '9', '3', '10', '6', '8', '11']
	},
	{
		id: 'night',
		name: 'Đêm',
		description: 'Đẹp trên giao diện tối',
		colorIds: ['9', '3', '10', '7', '1', '11', '2', '6', '4', '5', '8']
	}
];

const STORAGE_PREFIX = 'bkalendar-next:course-colors:';

export function courseColorStorageKey(profileId: string): string {
	return `${STORAGE_PREFIX}${normalizeProfileId(profileId)}`;
}

export function createCourseAppearanceTransferMessage(
	profileId: string,
	preferences: CourseColorPreferences
): CourseAppearanceTransferMessage {
	return {
		source: 'bkalendar-web',
		type: COURSE_APPEARANCE_TRANSFER_TYPE,
		version: COURSE_APPEARANCE_TRANSFER_VERSION,
		profileId: normalizeProfileId(profileId),
		preferences: normalizeCourseColorPreferences(preferences)
	};
}

export function isCourseAppearanceTransferMessage(
	value: unknown
): value is CourseAppearanceTransferMessage {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const candidate = value as Record<string, unknown>;
	if (
		candidate.source !== 'bkalendar-web' ||
		candidate.type !== COURSE_APPEARANCE_TRANSFER_TYPE ||
		candidate.version !== COURSE_APPEARANCE_TRANSFER_VERSION ||
		!validProfileId(candidate.profileId)
	) {
		return false;
	}
	return isCourseColorPreferences(candidate.preferences);
}

export function defaultCourseColorPreferences(): CourseColorPreferences {
	return {
		schemaVersion: 1,
		mode: 'course',
		seed: 0,
		monoColorId: '7',
		overrides: {},
		icons: {}
	};
}

export function courseIdentity(event: Pick<ManagedEvent, 'courseCode' | 'title'>): string {
	return (event.courseCode || event.title).normalize('NFKC').trim().toLocaleUpperCase('vi-VN');
}

export function buildCourseColorAssignments(
	events: ManagedEvent[],
	preferences: CourseColorPreferences
): Record<string, string> {
	const courses = [...new Set(events.map(courseIdentity))].sort((left, right) =>
		left.localeCompare(right, 'vi')
	);
	if (preferences.mode === 'mono') {
		const color = validColorId(preferences.monoColorId) ? preferences.monoColorId : '7';
		return Object.fromEntries(courses.map((course) => [course, color]));
	}

	return Object.fromEntries(
		courses.map((course, index) => {
			const override = preferences.overrides[course];
			const palette = COURSE_COLOR_PALETTES[normalizedSeed(preferences.seed)]!;
			const generated = palette.colorIds[index % palette.colorIds.length]!;
			return [course, validColorId(override) ? override : generated];
		})
	);
}

export function summarizeCourseAppearances(
	events: ManagedEvent[],
	preferences: CourseColorPreferences
): CourseAppearanceSummary[] {
	const assignments = buildCourseColorAssignments(events, preferences);
	const courses = new Map<string, ManagedEvent>();
	for (const event of events) {
		const course = courseIdentity(event);
		if (!courses.has(course)) courses.set(course, event);
	}
	return [...courses.entries()]
		.sort(([left], [right]) => left.localeCompare(right, 'vi'))
		.map(([course, event]) => {
			const color = colorForId(assignments[course] ?? '7');
			const icon = validIcon(preferences.icons[course]) ? preferences.icons[course]! : '';
			return {
				course,
				courseCode: event.courseCode,
				title: event.title,
				colorId: color.id,
				colorName: color.name,
				background: color.background,
				foreground: color.foreground,
				icon
			};
		});
}

export function randomizeCourseColors(
	events: ManagedEvent[],
	preferences: CourseColorPreferences,
	random: () => number = Math.random
): CourseColorPreferences {
	const courses = [...new Set(events.map(courseIdentity))].sort((left, right) =>
		left.localeCompare(right, 'vi')
	);
	const colorIds = GOOGLE_EVENT_COLORS.map((color) => color.id);
	for (let index = colorIds.length - 1; index > 0; index -= 1) {
		const sample = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
		const swapIndex = Math.floor(sample * (index + 1));
		[colorIds[index], colorIds[swapIndex]] = [colorIds[swapIndex]!, colorIds[index]!];
	}
	return {
		...preferences,
		mode: 'course',
		overrides: Object.fromEntries(
			courses.map((course, index) => [course, colorIds[index % colorIds.length]!])
		)
	};
}

export function colorizeEventsForSync(
	events: ManagedEvent[],
	assignments: Record<string, string>,
	icons: Record<string, string> = {}
): ManagedEvent[] {
	return events.map((event) => {
		const course = courseIdentity(event);
		const colorId = validColorId(assignments[course]) ? assignments[course]! : '7';
		const icon = validIcon(icons[course]) ? icons[course]! : '';
		return {
			...event,
			colorId,
			...(icon ? { icon } : {}),
			sourceFingerprint: event.fingerprint ?? '',
			fingerprint: createPresentationFingerprint(event.fingerprint ?? '', colorId, icon)
		};
	});
}

export function colorForId(colorId: string): GoogleEventColor {
	return GOOGLE_EVENT_COLORS.find((color) => color.id === colorId) ?? GOOGLE_EVENT_COLORS[6]!;
}

export function createCourseColorStore(storage: CourseColorStorage): {
	load(profileId: string): CourseColorPreferences;
	save(profileId: string, preferences: CourseColorPreferences): void;
} {
	return {
		load(profileId) {
			const source = storage.getItem(courseColorStorageKey(profileId));
			if (!source) return defaultCourseColorPreferences();
			try {
				return normalizeCourseColorPreferences(JSON.parse(source) as unknown);
			} catch {
				return defaultCourseColorPreferences();
			}
		},
		save(profileId, preferences) {
			storage.setItem(
				courseColorStorageKey(profileId),
				JSON.stringify(normalizeCourseColorPreferences(preferences))
			);
		}
	};
}

export function normalizeCourseColorPreferences(value: unknown): CourseColorPreferences {
	const fallback = defaultCourseColorPreferences();
	if (!value || typeof value !== 'object') return fallback;
	const candidate = value as Partial<CourseColorPreferences>;
	if (candidate.schemaVersion !== 1) return fallback;
	const mode = candidate.mode === 'mono' || candidate.mode === 'course' ? candidate.mode : 'course';
	const seed =
		typeof candidate.seed === 'number' && Number.isSafeInteger(candidate.seed)
			? normalizedSeed(candidate.seed)
			: 0;
	const monoColorId = validColorId(candidate.monoColorId) ? candidate.monoColorId! : '7';
	return {
		schemaVersion: 1,
		mode,
		seed,
		monoColorId,
		overrides: normalizeRecord(candidate.overrides, validColorId),
		icons: normalizeRecord(candidate.icons, validIcon)
	};
}

export function isCourseColorPreferences(value: unknown): value is CourseColorPreferences {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const candidate = value as Partial<CourseColorPreferences>;
	if (
		candidate.schemaVersion !== 1 ||
		(candidate.mode !== 'mono' && candidate.mode !== 'course') ||
		typeof candidate.seed !== 'number' ||
		!Number.isSafeInteger(candidate.seed) ||
		!validColorId(candidate.monoColorId)
	) {
		return false;
	}
	return (
		isValidRecord(candidate.overrides, validColorId) && isValidRecord(candidate.icons, validIcon)
	);
}

function normalizeRecord(
	value: unknown,
	accept: (item: unknown) => boolean
): Record<string, string> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
			accept(item)
				? [[key.normalize('NFKC').trim().toLocaleUpperCase('vi-VN'), item as string]]
				: []
		)
	);
}

function isValidRecord(value: unknown, accept: (item: unknown) => boolean): boolean {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		Object.entries(value).every(
			([key, item]) => key.trim().length > 0 && key.length <= 160 && accept(item)
		)
	);
}

function validColorId(value: unknown): value is string {
	return typeof value === 'string' && GOOGLE_EVENT_COLORS.some((color) => color.id === value);
}

function validIcon(value: unknown): value is string {
	return typeof value === 'string' && (value === '' || isSingleGrapheme(value));
}

function normalizedSeed(value: number): number {
	return (
		((value % COURSE_COLOR_PALETTES.length) + COURSE_COLOR_PALETTES.length) %
		COURSE_COLOR_PALETTES.length
	);
}

function normalizeProfileId(value: string): string {
	if (!validProfileId(value)) throw new Error('Course appearance profile ID is required.');
	return value.trim();
}

function validProfileId(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0 && value.length <= 160;
}

function isSingleGrapheme(value: string): boolean {
	const normalized = value.normalize('NFC').trim();
	if (!normalized || normalized.length > 24) return false;
	return (
		[...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(normalized)].length === 1
	);
}
