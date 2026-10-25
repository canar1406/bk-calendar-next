import type { ManagedEvent, TimetableSnapshot } from '../../../../packages/timetable/src/index.ts';
import { colorForId, courseIdentity } from './course-colors.ts';
import { buildScheduleWeeks, selectDefaultScheduleWeek } from './schedule-view.ts';

export const WALLPAPER_FORMATS = {
	phone: { width: 1080, height: 2400, label: 'Điện thoại · 1080 × 2400' },
	desktop: { width: 2560, height: 1440, label: 'Máy tính · 2560 × 1440' }
} as const;

export const WALLPAPER_THEMES = {
	naruto: {
		label: 'Naruto (Đội 7 & Làng Lá Konoha)',
		subTag: 'NHẪN ĐẠO LÀNG LÁ · KONOHA',
		wallpaperFile: 'naruto.jpg'
	},
	dragonball: {
		label: 'Dragon Ball Z (Son Goku Bản Năng Vô Cực)',
		subTag: 'SIÊU XAYDA · NGỌC RỒNG 4 SAO',
		wallpaperFile: 'dragonball.jpg'
	},
	onepiece: {
		label: 'One Piece (Monkey D. Luffy & Mũ Rơm)',
		subTag: 'ĐẠI HẢI TRÌNH · BĂNG MŨ RƠM',
		wallpaperFile: 'onepiece.jpg'
	},
	kimetsu: {
		label: 'Thanh Gươm Diệt Quỷ (Tanjiro Kamado)',
		subTag: 'SÁT QUỶ ĐỘI · HƠI THỞ MẶT TRỜI',
		wallpaperFile: 'kimetsu.jpg'
	},
	jujutsu: {
		label: 'Chú Thuật Hồi Chiến (Gojo Satoru)',
		subTag: 'LÃNH ĐỊA TRIỂN KHAI · CHÚ THUẬT',
		wallpaperFile: 'jujutsu.jpg'
	},
	attackontitan: {
		label: 'Đại Chiến Titan (Levi Ackerman & Trinh Sát Đoàn)',
		subTag: 'TRINH SÁT ĐOÀN · ĐÔI CÁNH TỰ DO',
		wallpaperFile: 'attackontitan.jpg'
	},
	doraemon: {
		label: 'Doraemon (Căn Phòng Tuổi Thơ & Bảo Bối)',
		subTag: 'TÚI THẦN KỲ · CHONG CHÓNG TRE',
		wallpaperFile: 'doraemon.jpg'
	},
	conan: {
		label: 'Thám Tử Lừng Danh Conan (Shinichi & Haibara)',
		subTag: 'SỰ THẬT CHỈ CÓ MỘT · CONAN',
		wallpaperFile: 'conan.jpg'
	},
	pokemon: {
		label: 'Pokémon (Pikachu & Khu Rừng Huyền Bí)',
		subTag: 'HUẤN LUYỆN VIÊN · POKÉMON',
		wallpaperFile: 'pokemon.jpg'
	},
	sailormoon: {
		label: 'Thủy Thủ Mặt Trăng (Usagi & Mèo Luna)',
		subTag: 'VƯƠNG QUỐC MẶT TRĂNG · PHA LÊ',
		wallpaperFile: 'sailormoon.jpg'
	},
	shinkai: {
		label: 'Your Name — Tên Cậu Là Gì? (Taki & Sao Băng)',
		subTag: 'HOÀNG HÔN SAO BĂNG · YOUR NAME',
		wallpaperFile: 'shinkai.jpg'
	},
	akihabara: {
		label: 'Cyberpunk: Edgerunners (David & Lucy)',
		subTag: 'THÀNH PHỐ ĐÊM · EDGERUNNERS',
		wallpaperFile: 'akihabara.jpg'
	},
	sakura: {
		label: 'Học Viện Hoa Anh Đào (Thiếu Nữ Mùa Xuân)',
		subTag: 'ĐÊM HOA ANH ĐÀO · SAKURA',
		wallpaperFile: 'sakura.jpg'
	},
	manga: {
		label: 'Trang Truyện Manga (Giấy Mực Đen)',
		subTag: 'PHONG CÁCH TRUYỆN TRANH',
		wallpaperFile: ''
	},
	dark: {
		label: 'Đêm Xanh Tối Giản (Không nhân vật)',
		subTag: 'ĐÊM XANH CỔ ĐIỂN',
		wallpaperFile: ''
	},
	light: {
		label: 'Sương Sáng Tối Giản (Không nhân vật)',
		subTag: 'SƯƠNG SÁNG DỊU NHẸ',
		wallpaperFile: ''
	}
} as const;

export type WallpaperTheme = keyof typeof WALLPAPER_THEMES;

export const WALLPAPER_MASCOTS = {
	auto: 'Biểu tượng theo bộ Anime đang chọn (Tự động)',
	neko: 'Mèo Phép Thuật (Mèo Luna)',
	'magic-circle': 'Vòng Phép Thuật (Ấn chú sao)',
	kitsune: 'Mặt Nạ Hồ Ly',
	none: 'Tối giản (Ẩn biểu tượng góc)'
} as const;

export type WallpaperMascot = keyof typeof WALLPAPER_MASCOTS;

export const WALLPAPER_MOTTOS = [
	'Quyết tâm qua môn — Nhẫn đạo không bao giờ bỏ cuộc!',
	'Công lực 9999 — Thi cử toàn thắng A+!',
	'Vượt Đại Hải Trình — Chinh phục mọi kỳ thi!',
	'Hơi thở Tập Trung Toàn Phần — Chém bay đề thi!',
	'Lãnh Địa Triển Khai — Điểm 10 tuyệt đối!',
	'Sự thật chỉ có một — Đáp án nào cũng trúng!'
] as const;

export const WALLPAPER_EXAM_PHASES = {
	midterm: 'Thi Giữa kỳ (GK)',
	final: 'Thi Cuối kỳ (CK)',
	all: 'Tất cả ca thi (GK + CK)'
} as const;

export type WallpaperExamPhase = keyof typeof WALLPAPER_EXAM_PHASES;

export function classifyExamPhase(event: ManagedEvent): 'midterm' | 'final' | 'other' {
	const raw = `${event.metadata?.examType ?? ''} ${event.title}`.trim();
	if (/^(?:gk|giữa\s*k[ỳì]|btl)\b/iu.test(raw)) return 'midterm';
	if (/^(?:ck|cuối\s*k[ỳì]|thi\s*cuối)\b/iu.test(raw)) return 'final';
	return 'other';
}

export function getAvailableExamPhases(events: ManagedEvent[]): WallpaperExamPhase[] {
	const phases: WallpaperExamPhase[] = [];
	if (events.some((event) => classifyExamPhase(event) === 'midterm')) phases.push('midterm');
	if (events.some((event) => classifyExamPhase(event) === 'final')) phases.push('final');
	if (events.length > 0) phases.push('all');
	return phases;
}

export interface WallpaperOptions {
	format: keyof typeof WALLPAPER_FORMATS;
	theme?: WallpaperTheme;
	mascot?: WallpaperMascot;
	motto?: string;
	overlayOpacity?: number;
	customBackground?: CanvasImageSource | null;
	customBackgroundWidth?: number;
	customBackgroundHeight?: number;
	weekKey?: string;
	examPhase?: WallpaperExamPhase;
	colorAssignments?: Record<string, string>;
	courseIcons?: Record<string, string>;
}

export interface WallpaperModel {
	width: number;
	height: number;
	format: WallpaperOptions['format'];
	theme: WallpaperTheme;
	mascot: WallpaperMascot;
	motto: string;
	overlayOpacity: number;
	customBackground: CanvasImageSource | null;
	customBackgroundWidth: number;
	customBackgroundHeight: number;
	scheduleKind: 'classes' | 'exams';
	examPhase: WallpaperExamPhase;
	title: string;
	subtitle: string;
	semester: number;
	filename: string;
	events: ManagedEvent[];
}

export function buildWallpaperModel(
	snapshot: TimetableSnapshot,
	options: WallpaperOptions
): WallpaperModel {
	if (snapshot.provenance === 'sample') {
		throw new Error('Dữ liệu mẫu chỉ dùng để xem trước, không thể xuất hình nền.');
	}
	const exams = snapshot.scheduleKind === 'exams';
	const weeks = buildScheduleWeeks(snapshot.events);
	const week = options.weekKey
		? weeks.find((item) => item.key === options.weekKey)
		: selectDefaultScheduleWeek(weeks);
	if (!exams && options.weekKey && !week) {
		throw new Error('Tuần đã chọn không còn trong lịch. Hãy chọn lại tuần hiển thị.');
	}
	const allEvents = exams
		? weeks.flatMap((item) => item.events).sort((a, b) => a.start.localeCompare(b.start))
		: (week?.events ?? []);
	if (!allEvents.length) throw new Error('Chưa có buổi học hoặc ca thi hợp lệ để xuất hình nền.');

	let examPhase: WallpaperExamPhase = options.examPhase ?? 'midterm';
	let events = allEvents;
	let examTitle = 'LỊCH THI';
	let examSubtitle = 'Tất cả ca thi đã có ngày · Giờ Việt Nam';
	let examSlug = 'lich-thi';

	if (exams) {
		const midtermEvents = allEvents.filter((event) => classifyExamPhase(event) === 'midterm');
		const finalEvents = allEvents.filter((event) => classifyExamPhase(event) === 'final');
		if (options.examPhase === 'all') {
			examPhase = 'all';
			events = allEvents;
		} else if (options.examPhase === 'final' && finalEvents.length > 0) {
			examPhase = 'final';
			events = finalEvents;
		} else if (options.examPhase === 'midterm' && midtermEvents.length > 0) {
			examPhase = 'midterm';
			events = midtermEvents;
		} else if (midtermEvents.length > 0) {
			examPhase = 'midterm';
			events = midtermEvents;
		} else if (finalEvents.length > 0) {
			examPhase = 'final';
			events = finalEvents;
		} else {
			examPhase = 'all';
			events = allEvents;
		}
		if (examPhase !== 'all' && (midtermEvents.length > 0 || finalEvents.length > 0)) {
			examTitle = examPhase === 'final' ? 'LỊCH THI CUỐI KỲ' : 'LỊCH THI GIỮA KỲ';
			examSubtitle =
				examPhase === 'final'
					? 'Đợt thi Cuối kỳ (CK) · Giờ Việt Nam'
					: 'Đợt thi Giữa kỳ (GK) · Giờ Việt Nam';
			examSlug = examPhase === 'final' ? 'lich-thi-ck' : 'lich-thi-gk';
		}
	}

	for (const event of events) {
		if (
			!Number.isFinite(Date.parse(event.end)) ||
			Date.parse(event.end) <= Date.parse(event.start)
		) {
			throw new Error('Lịch có giờ kết thúc không hợp lệ. Hãy nhập lại dữ liệu.');
		}
	}
	const year = week?.key.slice(0, 4) ?? '';
	const theme = options.theme ?? 'naruto';
	return {
		...WALLPAPER_FORMATS[options.format],
		format: options.format,
		theme,
		mascot: options.mascot ?? 'auto',
		motto: options.motto?.trim() || WALLPAPER_MOTTOS[0],
		overlayOpacity: Math.min(0.88, Math.max(0.12, options.overlayOpacity ?? 0.32)),
		customBackground: options.customBackground ?? null,
		customBackgroundWidth: options.customBackgroundWidth ?? 0,
		customBackgroundHeight: options.customBackgroundHeight ?? 0,
		scheduleKind: exams ? 'exams' : 'classes',
		examPhase,
		title: exams ? examTitle : 'THỜI KHÓA BIỂU',
		subtitle: exams ? examSubtitle : `${week!.label} / ${year}`,
		semester: snapshot.semester,
		filename: `bkalendar-${exams ? examSlug : `tuan-${week!.key}`}-hk${snapshot.semester}-${options.format}-${theme}.png`,
		events: events.map((event) => ({
			...event,
			colorId: options.colorAssignments?.[courseIdentity(event)] ?? event.colorId ?? '7',
			icon: options.courseIcons?.[courseIdentity(event)] ?? event.icon ?? ''
		}))
	};
}

const FONT = '"Be Vietnam Pro", sans-serif';
const MONO = '"IBM Plex Mono", monospace';
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

interface ThemePalette {
	bgStops: [string, string, string, string];
	ink: string;
	muted: string;
	line: string;
	card: string;
	cardBorder: string;
	accent: string;
	secondaryAccent: string;
	badgeBg: string;
	badgeInk: string;
	sealBg: string;
	sealInk: string;
	isLight: boolean;
	isManga: boolean;
}

function getThemePalette(theme: WallpaperTheme): ThemePalette {
	switch (theme) {
		case 'naruto':
			return {
				bgStops: ['#0d1118', '#1b1d29', '#3d1f16', '#7a2e14'],
				ink: '#fff8f0',
				muted: '#e0c5b1',
				line: '#6e3b23',
				card: 'rgba(20, 22, 31, 0.84)',
				cardBorder: 'rgba(255, 136, 36, 0.48)',
				accent: '#ff8824',
				secondaryAccent: '#4dd4ff',
				badgeBg: 'rgba(255, 136, 36, 0.22)',
				badgeInk: '#ffd2a6',
				sealBg: '#e03e1a',
				sealInk: '#fff9f5',
				isLight: false,
				isManga: false
			};
		case 'dragonball':
			return {
				bgStops: ['#070d24', '#132152', '#4a2511', '#96430f'],
				ink: '#fffdf5',
				muted: '#f0d8a8',
				line: '#805319',
				card: 'rgba(15, 22, 48, 0.82)',
				cardBorder: 'rgba(255, 183, 3, 0.52)',
				accent: '#ffb703',
				secondaryAccent: '#38b6ff',
				badgeBg: 'rgba(255, 183, 3, 0.22)',
				badgeInk: '#ffe699',
				sealBg: '#e63900',
				sealInk: '#fffdf5',
				isLight: false,
				isManga: false
			};
		case 'onepiece':
			return {
				bgStops: ['#051626', '#0b2e4d', '#14496b', '#1f6480'],
				ink: '#f7fcff',
				muted: '#b5d6e8',
				line: '#2d6a8c',
				card: 'rgba(9, 29, 48, 0.82)',
				cardBorder: 'rgba(255, 195, 0, 0.45)',
				accent: '#ffc300',
				secondaryAccent: '#ff5964',
				badgeBg: 'rgba(255, 195, 0, 0.2)',
				badgeInk: '#ffe899',
				sealBg: '#d92638',
				sealInk: '#ffffff',
				isLight: false,
				isManga: false
			};
		case 'kimetsu':
			return {
				bgStops: ['#070d0d', '#0f211d', '#1d362d', '#421818'],
				ink: '#f5fffb',
				muted: '#b4d6c8',
				line: '#29634e',
				card: 'rgba(12, 24, 21, 0.84)',
				cardBorder: 'rgba(46, 196, 150, 0.48)',
				accent: '#2ec496',
				secondaryAccent: '#ff5a36',
				badgeBg: 'rgba(46, 196, 150, 0.2)',
				badgeInk: '#b8f5e0',
				sealBg: '#d92b2b',
				sealInk: '#fff8f5',
				isLight: false,
				isManga: false
			};
		case 'jujutsu':
			return {
				bgStops: ['#04040c', '#0b0921', '#1b103d', '#31145c'],
				ink: '#f6f2ff',
				muted: '#beb2e0',
				line: '#4c2c85',
				card: 'rgba(12, 10, 29, 0.85)',
				cardBorder: 'rgba(177, 102, 255, 0.48)',
				accent: '#b56eff',
				secondaryAccent: '#00d4ff',
				badgeBg: 'rgba(181, 110, 255, 0.22)',
				badgeInk: '#e4c7ff',
				sealBg: '#e6195e',
				sealInk: '#ffffff',
				isLight: false,
				isManga: false
			};
		case 'attackontitan':
			return {
				bgStops: ['#0f1210', '#1b241e', '#2b3329', '#452b20'],
				ink: '#f4f7f2',
				muted: '#bfc9bd',
				line: '#45594a',
				card: 'rgba(20, 26, 22, 0.85)',
				cardBorder: 'rgba(82, 183, 136, 0.45)',
				accent: '#52b788',
				secondaryAccent: '#f4a261',
				badgeBg: 'rgba(82, 183, 136, 0.2)',
				badgeInk: '#c7f2dc',
				sealBg: '#9e2a2b',
				sealInk: '#fff8f2',
				isLight: false,
				isManga: false
			};
		case 'doraemon':
			return {
				bgStops: ['#061d38', '#0c396b', '#145a9e', '#1c77c3'],
				ink: '#ffffff',
				muted: '#c4e3ff',
				line: '#3a8fd9',
				card: 'rgba(8, 35, 68, 0.82)',
				cardBorder: 'rgba(255, 214, 10, 0.5)',
				accent: '#ffd60a',
				secondaryAccent: '#ff4d6d',
				badgeBg: 'rgba(255, 214, 10, 0.22)',
				badgeInk: '#fff099',
				sealBg: '#e62e2d',
				sealInk: '#ffffff',
				isLight: false,
				isManga: false
			};
		case 'conan':
			return {
				bgStops: ['#060d1a', '#0e1e38', '#193158', '#3b1522'],
				ink: '#f2f7ff',
				muted: '#adc4e6',
				line: '#2e5185',
				card: 'rgba(11, 22, 43, 0.84)',
				cardBorder: 'rgba(76, 201, 240, 0.45)',
				accent: '#4cc9f0',
				secondaryAccent: '#ef233c',
				badgeBg: 'rgba(239, 35, 60, 0.24)',
				badgeInk: '#ffb3be',
				sealBg: '#d90429',
				sealInk: '#ffffff',
				isLight: false,
				isManga: false
			};
		case 'pokemon':
			return {
				bgStops: ['#091026', '#14224a', '#233670', '#3d2252'],
				ink: '#fffdf7',
				muted: '#c2cff0',
				line: '#3f569c',
				card: 'rgba(14, 24, 54, 0.84)',
				cardBorder: 'rgba(255, 203, 5, 0.5)',
				accent: '#ffcb05',
				secondaryAccent: '#ff3855',
				badgeBg: 'rgba(255, 203, 5, 0.22)',
				badgeInk: '#ffea94',
				sealBg: '#ee1515',
				sealInk: '#ffffff',
				isLight: false,
				isManga: false
			};
		case 'sailormoon':
			return {
				bgStops: ['#120824', '#261247', '#4f1e66', '#8c3278'],
				ink: '#fff7fc',
				muted: '#e6bfe0',
				line: '#7d3c85',
				card: 'rgba(28, 12, 48, 0.80)',
				cardBorder: 'rgba(255, 209, 102, 0.48)',
				accent: '#ffd166',
				secondaryAccent: '#ff85b3',
				badgeBg: 'rgba(255, 209, 102, 0.22)',
				badgeInk: '#ffebb3',
				sealBg: '#e6397a',
				sealInk: '#ffffff',
				isLight: false,
				isManga: false
			};
		case 'shinkai':
			return {
				bgStops: ['#070b22', '#181c4b', '#431f57', '#b84a72'],
				ink: '#fdf7ff',
				muted: '#d2c2e8',
				line: '#6f4c8b',
				card: 'rgba(16, 15, 42, 0.78)',
				cardBorder: 'rgba(255, 158, 205, 0.38)',
				accent: '#ff8cc6',
				secondaryAccent: '#7be3ff',
				badgeBg: 'rgba(255, 140, 198, 0.2)',
				badgeInk: '#ffd0e8',
				sealBg: '#e63956',
				sealInk: '#fff8f8',
				isLight: false,
				isManga: false
			};
		case 'sakura':
			return {
				bgStops: ['#14091d', '#281238', '#4c1e4f', '#7c2f64'],
				ink: '#fff5fa',
				muted: '#e2bed5',
				line: '#7a3e6c',
				card: 'rgba(31, 14, 41, 0.80)',
				cardBorder: 'rgba(255, 179, 210, 0.42)',
				accent: '#ff9ebb',
				secondaryAccent: '#ffd166',
				badgeBg: 'rgba(255, 158, 187, 0.22)',
				badgeInk: '#ffe0ea',
				sealBg: '#d9386a',
				sealInk: '#fff5f8',
				isLight: false,
				isManga: false
			};
		case 'akihabara':
			return {
				bgStops: ['#05040f', '#0d0924', '#1b0c38', '#2a0f4d'],
				ink: '#f0f8ff',
				muted: '#a7b6d9',
				line: '#3b2866',
				card: 'rgba(11, 10, 28, 0.84)',
				cardBorder: 'rgba(0, 245, 212, 0.45)',
				accent: '#fcee0a',
				secondaryAccent: '#00f5d4',
				badgeBg: 'rgba(255, 42, 133, 0.24)',
				badgeInk: '#ff94c2',
				sealBg: '#ff2a85',
				sealInk: '#ffffff',
				isLight: false,
				isManga: false
			};
		case 'manga':
			return {
				bgStops: ['#f8f4ec', '#f3ede0', '#ede5d5', '#e5dac7'],
				ink: '#16131c',
				muted: '#4e4759',
				line: '#16131c',
				card: 'rgba(255, 253, 249, 0.94)',
				cardBorder: '#16131c',
				accent: '#d62839',
				secondaryAccent: '#16131c',
				badgeBg: '#16131c',
				badgeInk: '#fffdf9',
				sealBg: '#d62839',
				sealInk: '#fffdf9',
				isLight: true,
				isManga: true
			};
		case 'light':
			return {
				bgStops: ['#eef5fa', '#e4eff8', '#f5eaf2', '#fbe5ee'],
				ink: '#14283c',
				muted: '#4c657d',
				line: '#bfd2e0',
				card: 'rgba(255, 255, 255, 0.88)',
				cardBorder: 'rgba(110, 155, 195, 0.45)',
				accent: '#d6457a',
				secondaryAccent: '#007799',
				badgeBg: 'rgba(214, 69, 122, 0.14)',
				badgeInk: '#b02a5b',
				sealBg: '#d6457a',
				sealInk: '#ffffff',
				isLight: true,
				isManga: false
			};
		case 'dark':
		default:
			return {
				bgStops: ['#071320', '#0c2135', '#132f47', '#1a3b56'],
				ink: '#f0f7fc',
				muted: '#9fb8cc',
				line: '#26445c',
				card: 'rgba(16, 36, 54, 0.82)',
				cardBorder: 'rgba(128, 225, 207, 0.36)',
				accent: '#80e1cf',
				secondaryAccent: '#ff9ec7',
				badgeBg: 'rgba(128, 225, 207, 0.18)',
				badgeInk: '#b3f2e6',
				sealBg: '#e04f7b',
				sealInk: '#ffffff',
				isLight: false,
				isManga: false
			};
	}
}

export function wrapWallpaperText(
	value: string,
	maxWidth: number,
	measure: (text: string) => number,
	maxLines: number
): string[] {
	const result: string[] = [];
	let line = '';
	for (const word of value.replace(/\s+/gu, ' ').trim().split(' ')) {
		const candidate = line ? `${line} ${word}` : word;
		if (measure(candidate) <= maxWidth) {
			line = candidate;
			continue;
		}
		if (line) result.push(line);
		line = '';
		for (const character of word) {
			if (line && measure(line + character) > maxWidth) {
				result.push(line);
				line = character;
			} else line += character;
		}
	}
	if (line) result.push(line);
	return result.slice(0, maxLines).map((original, index) => {
		let text = original;
		if (index === maxLines - 1 && result.length > maxLines) text += '…';
		while (measure(text) > maxWidth && text.length > 1) {
			text = `${Array.from(text).slice(0, -2).join('')}…`;
		}
		return text;
	});
}

function createSeededRandom(seedInput: string): () => number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < seedInput.length; i++) {
		h ^= seedInput.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return () => {
		h += 0x6d2b79f5;
		let t = Math.imul(h ^ (h >>> 15), 1 | h);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Canvas stays local: no screenshot service, external network calls or timetable upload. */
export async function renderWallpaper(
	canvas: HTMLCanvasElement,
	model: WallpaperModel
): Promise<void> {
	await Promise.all([
		document.fonts.load(`400 28px ${FONT}`, 'Thời khóa biểu'),
		document.fonts.load(`600 28px ${FONT}`, 'Lịch thi'),
		document.fonts.load(`700 72px ${FONT}`, 'LỊCH THI'),
		document.fonts.load(`500 24px ${MONO}`, '0123456789')
	]);
	canvas.width = model.width;
	canvas.height = model.height;
	const ctx = canvas.getContext('2d');
	if (!ctx)
		throw new Error('Trình duyệt không hỗ trợ tạo hình nền. Hãy thử Chrome hoặc Safari mới.');
	const phone = model.format === 'phone';
	const palette = getThemePalette(model.theme);
	const rand = createSeededRandom(`${model.semester}:${model.scheduleKind}:${model.theme}`);
	const margin = phone ? 68 : 96;
	const width = model.width - margin * 2;
	const exams = model.scheduleKind === 'exams';

	drawBackground();
	drawAtmosphereDecorations();

	const top = phone ? 320 : 108;
	drawHeader(top);

	const contentTop = top + (phone ? 242 : 244);
	const bottom = model.height - (phone ? 164 : 118);
	const contentHeight = bottom - contentTop;

	if (exams) drawExams(contentTop, contentHeight);
	else if (phone) drawPhoneWeek(contentTop, contentHeight);
	else drawDesktopWeek(contentTop, contentHeight);

	drawFooter();

	function drawBackground(): void {
		if (model.customBackground) {
			const imgW = model.customBackgroundWidth || model.width;
			const imgH = model.customBackgroundHeight || model.height;
			const scale = Math.max(model.width / imgW, model.height / imgH);
			const drawW = imgW * scale;
			const drawH = imgH * scale;
			const offsetX = (model.width - drawW) / 2;
			const offsetY = (model.height - drawH) / 2;
			ctx!.drawImage(model.customBackground, offsetX, offsetY, drawW, drawH);

			// Cinematic multi-stop vignette: protects header/footer text while keeping the anime character vivid in the middle
			const overlay = ctx!.createLinearGradient(0, 0, 0, model.height);
			const alpha = model.overlayOpacity;
			if (palette.isLight) {
				overlay.addColorStop(0, `rgba(248, 244, 238, ${Math.min(0.92, alpha + 0.14)})`);
				overlay.addColorStop(0.45, `rgba(248, 244, 238, ${Math.max(0.08, alpha * 0.6)})`);
				overlay.addColorStop(1, `rgba(238, 230, 220, ${Math.min(0.95, alpha + 0.18)})`);
			} else {
				overlay.addColorStop(0, `rgba(6, 9, 20, ${Math.min(0.92, alpha + 0.28)})`);
				overlay.addColorStop(0.22, `rgba(8, 12, 26, ${Math.min(0.88, alpha + 0.1)})`);
				overlay.addColorStop(0.55, `rgba(10, 12, 28, ${Math.max(0.08, alpha * 0.58)})`);
				overlay.addColorStop(1, `rgba(6, 8, 20, ${Math.min(0.94, alpha + 0.26)})`);
			}
			ctx!.fillStyle = overlay;
			ctx!.fillRect(0, 0, model.width, model.height);

			// Subtle theme color aura in top-left behind title
			const topGlow = ctx!.createRadialGradient(
				margin + 180,
				phone ? 380 : 160,
				20,
				margin + 180,
				phone ? 380 : 160,
				phone ? 520 : 680
			);
			topGlow.addColorStop(0, `${palette.accent}28`);
			topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
			ctx!.fillStyle = topGlow;
			ctx!.fillRect(0, 0, model.width, model.height);
			return;
		}

		const sky = ctx!.createLinearGradient(0, 0, 0, model.height);
		sky.addColorStop(0, palette.bgStops[0]);
		sky.addColorStop(0.42, palette.bgStops[1]);
		sky.addColorStop(0.78, palette.bgStops[2]);
		sky.addColorStop(1, palette.bgStops[3]);
		ctx!.fillStyle = sky;
		ctx!.fillRect(0, 0, model.width, model.height);

		const aura = ctx!.createRadialGradient(
			model.width * 0.76,
			model.height * 0.18,
			20,
			model.width * 0.76,
			model.height * 0.18,
			model.width * 0.65
		);
		aura.addColorStop(0, `${palette.accent}38`);
		aura.addColorStop(0.5, `${palette.secondaryAccent}18`);
		aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx!.fillStyle = aura;
		ctx!.fillRect(0, 0, model.width, model.height);
	}

	function drawAtmosphereDecorations(): void {
		ctx!.save();
		const hasPhotoBg = Boolean(model.customBackground);

		if (!hasPhotoBg) {
			if (palette.isManga) {
				drawMangaScreentone();
				drawMangaSpeedLines();
			} else if (model.theme === 'akihabara' || model.theme === 'conan') {
				drawCyberGrid();
			} else {
				drawSubtleStarGrid();
			}

			if (!palette.isLight) {
				drawTwinklingStars(phone ? 52 : 90);
			}
		}

		// Theme-specific atmospheric effects (toned down when character artwork is visible)
		switch (model.theme) {
			case 'naruto':
				drawChakraEmbers(hasPhotoBg ? 18 : phone ? 34 : 56, '#ff8824', '#4dd4ff');
				break;
			case 'dragonball':
				drawSaiyanLightningAndKi(hasPhotoBg ? 18 : phone ? 36 : 60);
				break;
			case 'onepiece':
				if (!hasPhotoBg) drawOceanWaves();
				break;
			case 'kimetsu':
				drawKimetsuCheckeredTrim();
				drawChakraEmbers(hasPhotoBg ? 16 : phone ? 32 : 52, '#ff5a36', '#2ec496');
				break;
			case 'jujutsu':
				if (!hasPhotoBg) {
					drawHollowPurpleClash(phone ? model.width * 0.74 : model.width * 0.64, phone ? 210 : 175);
				}
				break;
			case 'attackontitan':
				if (!hasPhotoBg) drawCoordinatePaths();
				break;
			case 'doraemon':
				if (!hasPhotoBg) {
					drawTimeTunnelRings(phone ? model.width * 0.74 : model.width * 0.65, phone ? 210 : 180);
				}
				break;
			case 'conan':
				if (!hasPhotoBg) {
					drawDetectiveCrosshair(
						phone ? model.width * 0.74 : model.width * 0.64,
						phone ? 210 : 185
					);
				}
				break;
			case 'pokemon':
				drawSaiyanLightningAndKi(hasPhotoBg ? 14 : phone ? 30 : 48);
				break;
			case 'sailormoon':
				drawSakuraPetals(hasPhotoBg ? 16 : phone ? 26 : 40);
				if (!hasPhotoBg) {
					drawCrescentMoon(
						phone ? model.width * 0.78 : model.width * 0.56,
						phone ? 175 : 138,
						phone ? 42 : 52
					);
				}
				break;
			case 'shinkai':
			case 'dark':
				if (!hasPhotoBg) {
					drawShinkaiComet();
					drawCrescentMoon(
						phone ? model.width * 0.78 : model.width * 0.56,
						phone ? 175 : 138,
						phone ? 38 : 46
					);
				}
				break;
			case 'sakura':
			case 'light':
				drawSakuraPetals(hasPhotoBg ? 18 : phone ? 28 : 44);
				break;
			case 'akihabara':
				if (!hasPhotoBg) {
					drawHalftoneCorner(0, 0, phone ? 320 : 460);
					drawHalftoneCorner(model.width, model.height, phone ? 320 : 460, true);
				}
				break;
		}

		// Position emblem / mascot cleanly to the left of the top-right semester stamp
		const emblemX = phone ? model.width - margin - 105 : model.width - margin - 430;
		const emblemY = phone ? 445 : 208;
		const emblemScale = phone ? 0.84 : 1.0;

		if (model.mascot === 'auto') {
			drawSeriesEmblem(emblemX, emblemY, emblemScale);
		} else if (model.mascot === 'magic-circle') {
			drawMagicCircle(emblemX, emblemY, phone ? 115 : 138);
		} else if (model.mascot === 'neko') {
			drawMagicCircle(emblemX, emblemY, phone ? 105 : 122);
			drawAnimeNekoMascot(emblemX, emblemY + 12, phone ? 0.82 : 0.96);
		} else if (model.mascot === 'kitsune') {
			drawKitsuneMascot(emblemX, emblemY + 10, phone ? 0.82 : 0.96);
		}

		drawOuterFrame();
		ctx!.restore();
	}

	function drawSeriesEmblem(cx: number, cy: number, scale: number): void {
		switch (model.theme) {
			case 'naruto':
				drawNarutoEmblem(cx, cy, scale);
				break;
			case 'dragonball':
				drawDragonBallEmblem(cx, cy, scale);
				break;
			case 'onepiece':
				drawOnePieceEmblem(cx, cy, scale);
				break;
			case 'kimetsu':
				drawKimetsuEmblem(cx, cy, scale);
				break;
			case 'jujutsu':
				drawJujutsuEmblem(cx, cy, scale);
				break;
			case 'attackontitan':
				drawTitanWingsEmblem(cx, cy, scale);
				break;
			case 'doraemon':
				drawDoraemonBellEmblem(cx, cy, scale);
				break;
			case 'conan':
				drawConanEmblem(cx, cy, scale);
				break;
			case 'pokemon':
				drawPokeballEmblem(cx, cy, scale);
				break;
			case 'sailormoon':
				drawSailorMoonEmblem(cx, cy, scale);
				break;
			default:
				drawMagicCircle(cx, cy, 118 * scale);
				drawAnimeNekoMascot(cx, cy + 10, 0.92 * scale);
				break;
		}
	}

	/** 🍥 Naruto: Konoha Forehead Protector Metal Plate + Leaf Spiral + Kunai */
	function drawNarutoEmblem(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		// Chakra aura glow
		const aura = ctx!.createRadialGradient(0, 0, 12, 0, 0, 105);
		aura.addColorStop(0, 'rgba(255, 136, 36, 0.42)');
		aura.addColorStop(1, 'rgba(255, 136, 36, 0)');
		ctx!.fillStyle = aura;
		ctx!.beginPath();
		ctx!.arc(0, 0, 105, 0, Math.PI * 2);
		ctx!.fill();

		// Headband cloth strap
		ctx!.fillStyle = '#1b263b';
		roundBox(-92, -36, 184, 72, '#1b263b', 18);

		// Metallic headband plate
		const metal = ctx!.createLinearGradient(-74, -28, 74, 28);
		metal.addColorStop(0, '#9aa5b1');
		metal.addColorStop(0.5, '#e4e7eb');
		metal.addColorStop(1, '#7b8794');
		roundBox(-74, -28, 148, 56, '#cbd2d9', 12);
		ctx!.fillStyle = metal;
		ctx!.beginPath();
		ctx!.roundRect(-74, -28, 148, 56, 12);
		ctx!.fill();
		ctx!.strokeStyle = '#323f4b';
		ctx!.lineWidth = 2.5;
		ctx!.stroke();

		// 6 rivets (3 left, 3 right)
		ctx!.fillStyle = '#3e4c59';
		for (const rx of [-60, 60]) {
			for (const ry of [-16, 0, 16]) {
				ctx!.beginPath();
				ctx!.arc(rx, ry, 3.2, 0, Math.PI * 2);
				ctx!.fill();
			}
		}

		// Konoha Leaf Village Spiral Symbol in the center
		ctx!.strokeStyle = '#1f2933';
		ctx!.lineWidth = 3.2;
		ctx!.lineCap = 'round';
		ctx!.beginPath();
		for (let t = 0; t <= Math.PI * 3.4; t += 0.15) {
			const r = 2 + t * 1.9;
			const px = -4 + Math.cos(t) * r;
			const py = 2 + Math.sin(t) * r;
			if (t === 0) ctx!.moveTo(px, py);
			else ctx!.lineTo(px, py);
		}
		ctx!.stroke();
		// Leaf tip triangle & stem
		ctx!.beginPath();
		ctx!.moveTo(12, -14);
		ctx!.lineTo(28, 2);
		ctx!.lineTo(10, 15);
		ctx!.stroke();
		ctx!.beginPath();
		ctx!.moveTo(-18, 14);
		ctx!.lineTo(-27, 20);
		ctx!.stroke();

		ctx!.restore();
	}

	/** 🐉 Dragon Ball Z: Glowing 4-Star Dragon Ball + Golden Shenron Aura */
	function drawDragonBallEmblem(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		const glow = ctx!.createRadialGradient(0, 0, 15, 0, 0, 108);
		glow.addColorStop(0, 'rgba(255, 195, 0, 0.55)');
		glow.addColorStop(0.6, 'rgba(255, 102, 0, 0.22)');
		glow.addColorStop(1, 'rgba(255, 102, 0, 0)');
		ctx!.fillStyle = glow;
		ctx!.beginPath();
		ctx!.arc(0, 0, 108, 0, Math.PI * 2);
		ctx!.fill();

		// Crystal orange sphere
		const sphere = ctx!.createRadialGradient(-18, -18, 8, 0, 0, 62);
		sphere.addColorStop(0, '#ffe169');
		sphere.addColorStop(0.45, '#ff9e00');
		sphere.addColorStop(0.85, '#e85d04');
		sphere.addColorStop(1, '#9d0208');
		ctx!.fillStyle = sphere;
		ctx!.beginPath();
		ctx!.arc(0, 0, 62, 0, Math.PI * 2);
		ctx!.fill();

		ctx!.strokeStyle = '#ffd166';
		ctx!.lineWidth = 2.5;
		ctx!.stroke();

		// 4 Red Five-Point Stars (Grandpa Gohan's 4-Star Ball!)
		const starPositions = [
			[-18, -14],
			[18, -14],
			[-14, 18],
			[16, 18]
		] as const;
		ctx!.fillStyle = '#d00000';
		for (const [sx, sy] of starPositions) {
			drawFivePointStar(sx, sy, 11, 4.8);
		}

		// Gloss highlight arc
		ctx!.strokeStyle = 'rgba(255, 255, 255, 0.65)';
		ctx!.lineWidth = 4;
		ctx!.lineCap = 'round';
		ctx!.beginPath();
		ctx!.arc(0, 0, 48, Math.PI * 1.12, Math.PI * 1.48);
		ctx!.stroke();

		ctx!.restore();
	}

	/** 🏴‍☠️ One Piece: Straw Hat Emblem */
	function drawOnePieceEmblem(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		// Golden sun halo
		const halo = ctx!.createRadialGradient(0, 0, 14, 0, 0, 100);
		halo.addColorStop(0, 'rgba(255, 195, 0, 0.38)');
		halo.addColorStop(1, 'rgba(255, 195, 0, 0)');
		ctx!.fillStyle = halo;
		ctx!.beginPath();
		ctx!.arc(0, 0, 100, 0, Math.PI * 2);
		ctx!.fill();

		// Crossed navigation compass / bones behind hat
		ctx!.strokeStyle = '#f8f9fa';
		ctx!.lineWidth = 7;
		ctx!.lineCap = 'round';
		for (const angle of [Math.PI / 4, -Math.PI / 4]) {
			ctx!.beginPath();
			ctx!.moveTo(Math.cos(angle) * -68, Math.sin(angle) * -68);
			ctx!.lineTo(Math.cos(angle) * 68, Math.sin(angle) * 68);
			ctx!.stroke();
		}

		// Luffy's Straw Hat Dome
		ctx!.fillStyle = '#f4b942';
		ctx!.strokeStyle = '#16131c';
		ctx!.lineWidth = 3;
		ctx!.beginPath();
		ctx!.arc(0, 4, 42, Math.PI, 0);
		ctx!.closePath();
		ctx!.fill();
		ctx!.stroke();

		// Red Ribbon Band
		ctx!.fillStyle = '#d92638';
		ctx!.beginPath();
		ctx!.rect(-41, -10, 82, 14);
		ctx!.fill();
		ctx!.stroke();

		// Wide Straw Hat Brim
		ctx!.fillStyle = '#f4b942';
		ctx!.beginPath();
		ctx!.ellipse(0, 6, 74, 14, 0, 0, Math.PI * 2);
		ctx!.fill();
		ctx!.stroke();

		ctx!.restore();
	}

	/** 🗡️ Demon Slayer: Tanjiro's Hanafuda Rising Sun Earrings & Nichirin Guard */
	function drawKimetsuEmblem(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		// Hanafuda card frame
		roundBox(-38, -58, 76, 116, '#fff8f2', 8);
		ctx!.strokeStyle = '#16131c';
		ctx!.lineWidth = 3;
		ctx!.strokeRect(-38, -58, 76, 116);

		// Rising sun rays inside card
		ctx!.save();
		ctx!.beginPath();
		ctx!.rect(-35, -55, 70, 85);
		ctx!.clip();

		ctx!.strokeStyle = '#d92b2b';
		ctx!.lineWidth = 4;
		for (let i = 0; i < 12; i++) {
			const angle = (i * Math.PI) / 6;
			ctx!.beginPath();
			ctx!.moveTo(0, -14);
			ctx!.lineTo(Math.cos(angle) * 70, -14 + Math.sin(angle) * 70);
			ctx!.stroke();
		}
		ctx!.fillStyle = '#d92b2b';
		ctx!.beginPath();
		ctx!.arc(0, -14, 18, 0, Math.PI * 2);
		ctx!.fill();
		ctx!.restore();

		// Lower dark mountain silhouette on Hanafuda card
		ctx!.fillStyle = '#1d2d2a';
		ctx!.beginPath();
		ctx!.rect(-35, 24, 70, 31);
		ctx!.fill();

		ctx!.restore();
	}

	/** 🤞 Jujutsu Kaisen: Gojo's Red (Aka), Blue (Ao), & Hollow Purple (Murasaki) */
	function drawJujutsuEmblem(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		// Blue sphere (Left)
		const blue = ctx!.createRadialGradient(-28, 0, 4, -28, 0, 42);
		blue.addColorStop(0, '#ffffff');
		blue.addColorStop(0.35, '#00d4ff');
		blue.addColorStop(1, 'rgba(0, 212, 255, 0)');
		ctx!.fillStyle = blue;
		ctx!.beginPath();
		ctx!.arc(-28, 0, 42, 0, Math.PI * 2);
		ctx!.fill();

		// Red sphere (Right)
		const red = ctx!.createRadialGradient(28, 0, 4, 28, 0, 42);
		red.addColorStop(0, '#ffffff');
		red.addColorStop(0.35, '#ff2a5f');
		red.addColorStop(1, 'rgba(255, 42, 95, 0)');
		ctx!.fillStyle = red;
		ctx!.beginPath();
		ctx!.arc(28, 0, 42, 0, Math.PI * 2);
		ctx!.fill();

		// Hollow Purple singularity in the center
		const purple = ctx!.createRadialGradient(0, 0, 6, 0, 0, 62);
		purple.addColorStop(0, '#ffffff');
		purple.addColorStop(0.4, '#c77dff');
		purple.addColorStop(0.75, '#7b2cbf');
		purple.addColorStop(1, 'rgba(123, 44, 191, 0)');
		ctx!.fillStyle = purple;
		ctx!.beginPath();
		ctx!.arc(0, 0, 62, 0, Math.PI * 2);
		ctx!.fill();

		ctx!.strokeStyle = '#e0aaff';
		ctx!.lineWidth = 2;
		ctx!.beginPath();
		ctx!.arc(0, 0, 34, 0, Math.PI * 2);
		ctx!.stroke();

		ctx!.restore();
	}

	/** ⚔️ Attack on Titan: Survey Corps Shield & Wings of Freedom */
	function drawTitanWingsEmblem(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		// Shield base
		ctx!.fillStyle = '#1f2922';
		ctx!.strokeStyle = '#f4a261';
		ctx!.lineWidth = 3;
		ctx!.beginPath();
		ctx!.moveTo(0, -56);
		ctx!.lineTo(48, -38);
		ctx!.lineTo(42, 16);
		ctx!.quadraticCurveTo(0, 58, 0, 62);
		ctx!.quadraticCurveTo(0, 58, -42, 16);
		ctx!.lineTo(-48, -38);
		ctx!.closePath();
		ctx!.fill();
		ctx!.stroke();

		// Left Blue Wing & Right White Wing
		for (const [dir, wingColor] of [
			[-1, '#1d4e89'],
			[1, '#f8f9fa']
		] as const) {
			ctx!.fillStyle = wingColor;
			for (let f = 0; f < 5; f++) {
				ctx!.beginPath();
				ctx!.ellipse(
					dir * (14 + f * 6),
					-18 + f * 12,
					18 - f * 1.8,
					5.5,
					dir * -0.35,
					0,
					Math.PI * 2
				);
				ctx!.fill();
			}
		}

		ctx!.restore();
	}

	/** 🔔 Doraemon: Golden Cat Bell + Red Collar */
	function drawDoraemonBellEmblem(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		// Red Collar Strap
		roundBox(-58, -32, 116, 20, '#e62e2d', 10);
		ctx!.strokeStyle = '#ffffff';
		ctx!.lineWidth = 2;
		ctx!.strokeRect(-54, -29, 108, 14);

		// Golden Bell Sphere
		const bell = ctx!.createRadialGradient(-10, -4, 5, 0, 12, 46);
		bell.addColorStop(0, '#fff3b0');
		bell.addColorStop(0.5, '#ffd60a');
		bell.addColorStop(1, '#cca000');
		ctx!.fillStyle = bell;
		ctx!.strokeStyle = '#5c4700';
		ctx!.lineWidth = 2.8;
		ctx!.beginPath();
		ctx!.arc(0, 12, 42, 0, Math.PI * 2);
		ctx!.fill();
		ctx!.stroke();

		// Bell middle ridge
		ctx!.fillStyle = '#ffd60a';
		roundBox(-45, 4, 90, 10, '#ffd60a', 5);
		ctx!.strokeRect(-45, 4, 90, 10);

		// Dark keyhole & slot
		ctx!.fillStyle = '#3d2c00';
		ctx!.beginPath();
		ctx!.arc(0, 26, 7, 0, Math.PI * 2);
		ctx!.fill();
		ctx!.fillRect(-2.5, 28, 5, 16);

		ctx!.restore();
	}

	/** 🔍 Detective Conan: Radar Glasses + Red Voice-Changing Bowtie */
	function drawConanEmblem(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		// Detective Glasses
		ctx!.strokeStyle = '#e0fbfc';
		ctx!.fillStyle = 'rgba(76, 201, 240, 0.22)';
		ctx!.lineWidth = 4;
		for (const lx of [-38, 38]) {
			ctx!.beginPath();
			ctx!.roundRect(lx - 28, -38, 56, 38, 8);
			ctx!.fill();
			ctx!.stroke();
		}
		// Bridge
		ctx!.beginPath();
		ctx!.moveTo(-10, -20);
		ctx!.lineTo(10, -20);
		ctx!.stroke();

		// Red Voice-Changing Bowtie below glasses
		ctx!.fillStyle = '#ef233c';
		ctx!.strokeStyle = '#ffffff';
		ctx!.lineWidth = 2;
		ctx!.beginPath();
		ctx!.moveTo(0, 26);
		ctx!.lineTo(-42, 8);
		ctx!.lineTo(-42, 44);
		ctx!.closePath();
		ctx!.fill();
		ctx!.stroke();

		ctx!.beginPath();
		ctx!.moveTo(0, 26);
		ctx!.lineTo(42, 8);
		ctx!.lineTo(42, 44);
		ctx!.closePath();
		ctx!.fill();
		ctx!.stroke();

		roundBox(-10, 16, 20, 20, '#d90429', 6);
		ctx!.strokeRect(-10, 16, 20, 20);

		ctx!.restore();
	}

	/** ⚡ Pokémon: Glowing Poké Ball + Thunderbolt */
	function drawPokeballEmblem(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		const glow = ctx!.createRadialGradient(0, 0, 10, 0, 0, 95);
		glow.addColorStop(0, 'rgba(255, 203, 5, 0.45)');
		glow.addColorStop(1, 'rgba(255, 203, 5, 0)');
		ctx!.fillStyle = glow;
		ctx!.beginPath();
		ctx!.arc(0, 0, 95, 0, Math.PI * 2);
		ctx!.fill();

		// Bottom white half
		ctx!.fillStyle = '#f8f9fa';
		ctx!.beginPath();
		ctx!.arc(0, 0, 56, 0, Math.PI);
		ctx!.closePath();
		ctx!.fill();

		// Top red half
		ctx!.fillStyle = '#ee1515';
		ctx!.beginPath();
		ctx!.arc(0, 0, 56, Math.PI, 0);
		ctx!.closePath();
		ctx!.fill();

		// Outer ring & middle black band
		ctx!.strokeStyle = '#16131c';
		ctx!.lineWidth = 6;
		ctx!.beginPath();
		ctx!.arc(0, 0, 56, 0, Math.PI * 2);
		ctx!.stroke();

		ctx!.beginPath();
		ctx!.moveTo(-56, 0);
		ctx!.lineTo(56, 0);
		ctx!.stroke();

		// Center button
		ctx!.fillStyle = '#ffffff';
		ctx!.beginPath();
		ctx!.arc(0, 0, 18, 0, Math.PI * 2);
		ctx!.fill();
		ctx!.stroke();

		ctx!.fillStyle = '#4cc9f0';
		ctx!.beginPath();
		ctx!.arc(0, 0, 9, 0, Math.PI * 2);
		ctx!.fill();

		ctx!.restore();
	}

	/** 🌙 Sailor Moon: Crescent Moon Brooch & Crystal Star */
	function drawSailorMoonEmblem(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		const glow = ctx!.createRadialGradient(0, 0, 10, 0, 0, 100);
		glow.addColorStop(0, 'rgba(255, 209, 102, 0.45)');
		glow.addColorStop(1, 'rgba(255, 133, 179, 0)');
		ctx!.fillStyle = glow;
		ctx!.beginPath();
		ctx!.arc(0, 0, 100, 0, Math.PI * 2);
		ctx!.fill();

		// Pink crystal heart/circle base
		ctx!.fillStyle = '#ff6b9d';
		ctx!.strokeStyle = '#ffd166';
		ctx!.lineWidth = 4;
		ctx!.beginPath();
		ctx!.arc(0, 0, 52, 0, Math.PI * 2);
		ctx!.fill();
		ctx!.stroke();

		// Golden crescent inside brooch
		ctx!.fillStyle = '#ffd166';
		ctx!.beginPath();
		ctx!.arc(0, 4, 34, 0, Math.PI * 2);
		ctx!.fill();

		ctx!.fillStyle = '#ff6b9d';
		ctx!.beginPath();
		ctx!.arc(0, -6, 26, 0, Math.PI * 2);
		ctx!.fill();

		// 5 planetary jewel dots
		const jewels = ['#ef233c', '#3a86ff', '#38b000', '#ffbe0b', '#fb5607'] as const;
		for (let i = 0; i < 5; i++) {
			const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
			ctx!.fillStyle = jewels[i]!;
			ctx!.beginPath();
			ctx!.arc(Math.cos(angle) * 44, Math.sin(angle) * 44, 5, 0, Math.PI * 2);
			ctx!.fill();
		}

		ctx!.restore();
	}

	function drawFivePointStar(cx: number, cy: number, outerR: number, innerR: number): void {
		ctx!.beginPath();
		for (let i = 0; i < 10; i++) {
			const angle = (i * Math.PI) / 5 - Math.PI / 2;
			const r = i % 2 === 0 ? outerR : innerR;
			const px = cx + Math.cos(angle) * r;
			const py = cy + Math.sin(angle) * r;
			if (i === 0) ctx!.moveTo(px, py);
			else ctx!.lineTo(px, py);
		}
		ctx!.closePath();
		ctx!.fill();
	}

	function drawChakraEmbers(count: number, colorA: string, colorB: string): void {
		ctx!.save();
		for (let i = 0; i < count; i++) {
			const px = rand() * model.width;
			const py = rand() * model.height;
			const r = 2 + rand() * 6;
			ctx!.fillStyle = i % 3 === 0 ? colorB : colorA;
			ctx!.globalAlpha = 0.2 + rand() * 0.45;
			ctx!.beginPath();
			ctx!.arc(px, py, r, 0, Math.PI * 2);
			ctx!.fill();
		}
		ctx!.restore();
	}

	function drawSaiyanLightningAndKi(count: number): void {
		ctx!.save();
		drawChakraEmbers(count, '#ffb703', '#38b6ff');
		ctx!.strokeStyle = '#ffea00';
		ctx!.lineWidth = 2.2;
		ctx!.globalAlpha = 0.35;
		for (let i = 0; i < 10; i++) {
			let lx = rand() * model.width;
			let ly = rand() * model.height * 0.6;
			ctx!.beginPath();
			ctx!.moveTo(lx, ly);
			for (let seg = 0; seg < 4; seg++) {
				lx += (rand() - 0.5) * 48;
				ly += 18 + rand() * 26;
				ctx!.lineTo(lx, ly);
			}
			ctx!.stroke();
		}
		ctx!.restore();
	}

	function drawOceanWaves(): void {
		ctx!.save();
		ctx!.strokeStyle = 'rgba(181, 214, 232, 0.22)';
		ctx!.lineWidth = 2;
		for (let row = 0; row < 4; row++) {
			const baseY = model.height - 190 + row * 34;
			ctx!.beginPath();
			for (let x = 0; x <= model.width; x += 40) {
				const y = baseY + Math.sin(x * 0.012 + row) * 10;
				if (x === 0) ctx!.moveTo(x, y);
				else ctx!.lineTo(x, y);
			}
			ctx!.stroke();
		}
		ctx!.restore();
	}

	function drawKimetsuCheckeredTrim(): void {
		ctx!.save();
		const sq = phone ? 18 : 22;
		ctx!.globalAlpha = 0.55;
		for (let x = 0; x < model.width; x += sq) {
			ctx!.fillStyle = (x / sq) % 2 === 0 ? '#2ec496' : '#0b1210';
			ctx!.fillRect(x, 0, sq, sq);
			ctx!.fillRect(x, model.height - sq, sq, sq);
		}
		ctx!.restore();
	}

	function drawHollowPurpleClash(cx: number, cy: number): void {
		ctx!.save();
		const glow = ctx!.createRadialGradient(cx, cy, 10, cx, cy, phone ? 220 : 320);
		glow.addColorStop(0, 'rgba(199, 125, 255, 0.38)');
		glow.addColorStop(0.5, 'rgba(0, 212, 255, 0.14)');
		glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx!.fillStyle = glow;
		ctx!.beginPath();
		ctx!.arc(cx, cy, phone ? 220 : 320, 0, Math.PI * 2);
		ctx!.fill();
		ctx!.restore();
	}

	function drawCoordinatePaths(): void {
		ctx!.save();
		const originX = model.width * 0.5;
		const originY = model.height;
		const grad = ctx!.createRadialGradient(originX, originY, 10, originX, originY, model.height);
		grad.addColorStop(0, 'rgba(244, 162, 97, 0.35)');
		grad.addColorStop(0.6, 'rgba(82, 183, 136, 0.12)');
		grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx!.strokeStyle = grad;
		ctx!.lineWidth = 4;
		for (let i = -5; i <= 5; i++) {
			ctx!.beginPath();
			ctx!.moveTo(originX, originY);
			ctx!.quadraticCurveTo(originX + i * 110, model.height * 0.45, originX + i * 260, 0);
			ctx!.stroke();
		}
		ctx!.restore();
	}

	function drawTimeTunnelRings(cx: number, cy: number): void {
		ctx!.save();
		ctx!.strokeStyle = 'rgba(255, 214, 10, 0.22)';
		ctx!.lineWidth = 2;
		for (let r = 40; r <= 240; r += 40) {
			ctx!.beginPath();
			ctx!.arc(cx, cy, r, 0, Math.PI * 2);
			ctx!.stroke();
		}
		ctx!.restore();
	}

	function drawDetectiveCrosshair(cx: number, cy: number): void {
		ctx!.save();
		ctx!.strokeStyle = 'rgba(76, 201, 240, 0.25)';
		ctx!.lineWidth = 2;
		for (const r of [60, 120, 180]) {
			ctx!.beginPath();
			ctx!.arc(cx, cy, r, 0, Math.PI * 2);
			ctx!.stroke();
		}
		ctx!.beginPath();
		ctx!.moveTo(cx - 210, cy);
		ctx!.lineTo(cx + 210, cy);
		ctx!.moveTo(cx, cy - 210);
		ctx!.lineTo(cx, cy + 210);
		ctx!.stroke();
		ctx!.restore();
	}

	function drawSubtleStarGrid(): void {
		ctx!.save();
		ctx!.strokeStyle = palette.line;
		ctx!.globalAlpha = palette.isLight ? 0.22 : 0.16;
		ctx!.lineWidth = 1;
		const step = 80;
		for (let x = 0; x < model.width; x += step) {
			ctx!.beginPath();
			ctx!.moveTo(x, 0);
			ctx!.lineTo(x, model.height);
			ctx!.stroke();
		}
		for (let y = 0; y < model.height; y += step) {
			ctx!.beginPath();
			ctx!.moveTo(0, y);
			ctx!.lineTo(model.width, y);
			ctx!.stroke();
		}
		ctx!.restore();
	}

	function drawCyberGrid(): void {
		ctx!.save();
		ctx!.strokeStyle = palette.accent;
		ctx!.globalAlpha = 0.16;
		ctx!.lineWidth = 1.2;
		const step = 64;
		for (let x = 0; x < model.width; x += step) {
			ctx!.beginPath();
			ctx!.moveTo(x, 0);
			ctx!.lineTo(x, model.height);
			ctx!.stroke();
		}
		for (let y = 0; y < model.height; y += step) {
			ctx!.beginPath();
			ctx!.moveTo(0, y);
			ctx!.lineTo(model.width, y);
			ctx!.stroke();
		}
		ctx!.restore();
	}

	function drawMangaScreentone(): void {
		ctx!.save();
		ctx!.fillStyle = '#16131c';
		ctx!.globalAlpha = 0.06;
		const spacing = 18;
		for (let y = 0; y < model.height; y += spacing) {
			for (let x = (y / spacing) % 2 === 0 ? 0 : spacing / 2; x < model.width; x += spacing) {
				const dist = Math.hypot(x - model.width * 0.85, y - model.height * 0.15);
				const radius = dist < model.width * 0.45 ? 3.2 : 1.6;
				ctx!.beginPath();
				ctx!.arc(x, y, radius, 0, Math.PI * 2);
				ctx!.fill();
			}
		}
		ctx!.restore();
	}

	function drawMangaSpeedLines(): void {
		ctx!.save();
		ctx!.strokeStyle = '#16131c';
		ctx!.globalAlpha = 0.07;
		const cx = model.width * 0.82;
		const cy = phone ? 380 : 180;
		for (let i = 0; i < 72; i++) {
			const angle = (i / 72) * Math.PI * 2;
			const inner = 160 + (i % 5) * 35;
			const outer = model.width * 1.2;
			ctx!.lineWidth = i % 3 === 0 ? 2.4 : 1;
			ctx!.beginPath();
			ctx!.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
			ctx!.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
			ctx!.stroke();
		}
		ctx!.restore();
	}

	function drawHalftoneCorner(cx: number, cy: number, maxDist: number, invert = false): void {
		ctx!.save();
		ctx!.fillStyle = invert ? palette.secondaryAccent : palette.accent;
		const step = 22;
		for (let y = 0; y < model.height; y += step) {
			for (let x = 0; x < model.width; x += step) {
				const d = Math.hypot(x - cx, y - cy);
				if (d < maxDist) {
					const ratio = 1 - d / maxDist;
					ctx!.globalAlpha = ratio * 0.25;
					ctx!.beginPath();
					ctx!.arc(x, y, ratio * 5, 0, Math.PI * 2);
					ctx!.fill();
				}
			}
		}
		ctx!.restore();
	}

	function drawTwinklingStars(count: number): void {
		ctx!.save();
		for (let i = 0; i < count; i++) {
			const x = rand() * model.width;
			const y = rand() * (model.height * 0.65);
			const r = 1 + rand() * 2.4;
			const alpha = 0.25 + rand() * 0.65;
			ctx!.fillStyle =
				i % 5 === 0 ? palette.accent : i % 7 === 0 ? palette.secondaryAccent : '#ffffff';
			ctx!.globalAlpha = alpha;
			if (i % 8 === 0) {
				drawFourPointStar(x, y, r * 3.8, r * 0.9);
			} else {
				ctx!.beginPath();
				ctx!.arc(x, y, r, 0, Math.PI * 2);
				ctx!.fill();
			}
		}
		ctx!.restore();
	}

	function drawFourPointStar(cx: number, cy: number, outerR: number, innerR: number): void {
		ctx!.beginPath();
		for (let i = 0; i < 8; i++) {
			const angle = (i * Math.PI) / 4;
			const radius = i % 2 === 0 ? outerR : innerR;
			const px = cx + Math.cos(angle) * radius;
			const py = cy + Math.sin(angle) * radius;
			if (i === 0) ctx!.moveTo(px, py);
			else ctx!.lineTo(px, py);
		}
		ctx!.closePath();
		ctx!.fill();
	}

	function drawShinkaiComet(): void {
		ctx!.save();
		const startX = model.width * (phone ? 0.1 : 0.3);
		const startY = phone ? 95 : 24;
		const headX = model.width * (phone ? 0.72 : 0.72);
		const headY = phone ? 280 : 230;

		const grad = ctx!.createLinearGradient(startX, startY, headX, headY);
		grad.addColorStop(0, 'rgba(123, 227, 255, 0)');
		grad.addColorStop(0.55, 'rgba(255, 140, 198, 0.24)');
		grad.addColorStop(0.88, 'rgba(123, 227, 255, 0.72)');
		grad.addColorStop(1, '#ffffff');

		ctx!.strokeStyle = grad;
		ctx!.lineWidth = phone ? 6 : 8;
		ctx!.lineCap = 'round';
		ctx!.beginPath();
		ctx!.moveTo(startX, startY);
		ctx!.quadraticCurveTo((startX + headX) * 0.52, (startY + headY) * 0.42, headX, headY);
		ctx!.stroke();

		const fragGrad = ctx!.createLinearGradient(startX + 60, startY + 25, headX - 55, headY + 42);
		fragGrad.addColorStop(0, 'rgba(255, 140, 198, 0)');
		fragGrad.addColorStop(0.7, 'rgba(255, 140, 198, 0.55)');
		fragGrad.addColorStop(1, '#ffd6ea');
		ctx!.strokeStyle = fragGrad;
		ctx!.lineWidth = phone ? 2.5 : 3.5;
		ctx!.beginPath();
		ctx!.moveTo(startX + 80, startY + 30);
		ctx!.quadraticCurveTo(
			(startX + headX) * 0.5,
			(startY + headY) * 0.5 + 24,
			headX - 55,
			headY + 42
		);
		ctx!.stroke();

		const headGlow = ctx!.createRadialGradient(headX, headY, 2, headX, headY, phone ? 44 : 64);
		headGlow.addColorStop(0, '#ffffff');
		headGlow.addColorStop(0.3, 'rgba(123, 227, 255, 0.85)');
		headGlow.addColorStop(0.7, 'rgba(255, 140, 198, 0.3)');
		headGlow.addColorStop(1, 'rgba(255, 140, 198, 0)');
		ctx!.fillStyle = headGlow;
		ctx!.beginPath();
		ctx!.arc(headX, headY, phone ? 44 : 64, 0, Math.PI * 2);
		ctx!.fill();

		ctx!.fillStyle = '#ffffff';
		drawFourPointStar(headX, headY, phone ? 22 : 30, 4);
		ctx!.restore();
	}

	function drawCrescentMoon(cx: number, cy: number, radius: number): void {
		ctx!.save();
		const glow = ctx!.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 2.4);
		glow.addColorStop(0, 'rgba(255, 240, 200, 0.32)');
		glow.addColorStop(1, 'rgba(255, 240, 200, 0)');
		ctx!.fillStyle = glow;
		ctx!.beginPath();
		ctx!.arc(cx, cy, radius * 2.4, 0, Math.PI * 2);
		ctx!.fill();

		ctx!.fillStyle = '#fff5d6';
		ctx!.beginPath();
		ctx!.arc(cx, cy, radius, 0, Math.PI * 2);
		ctx!.fill();

		ctx!.globalCompositeOperation = 'destination-out';
		ctx!.beginPath();
		ctx!.arc(cx - radius * 0.38, cy - radius * 0.18, radius * 0.86, 0, Math.PI * 2);
		ctx!.fill();
		ctx!.restore();
	}

	function drawSakuraPetals(count: number): void {
		ctx!.save();
		for (let i = 0; i < count; i++) {
			const px = rand() * model.width;
			const py = rand() * model.height;
			const size = 8 + rand() * 16;
			const angle = rand() * Math.PI * 2;
			ctx!.save();
			ctx!.translate(px, py);
			ctx!.rotate(angle);
			ctx!.globalAlpha = 0.25 + rand() * 0.5;
			ctx!.fillStyle = i % 3 === 0 ? '#ffc2d9' : i % 2 === 0 ? '#ff9ebb' : '#ffe3ee';
			ctx!.beginPath();
			ctx!.moveTo(0, -size);
			ctx!.bezierCurveTo(size * 0.9, -size * 0.8, size * 0.9, size * 0.5, 0, size);
			ctx!.bezierCurveTo(-size * 0.9, size * 0.5, -size * 0.9, -size * 0.8, 0, -size);
			ctx!.closePath();
			ctx!.fill();
			ctx!.restore();
		}
		ctx!.restore();
	}

	function drawMagicCircle(cx: number, cy: number, radius: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.strokeStyle = palette.accent;
		ctx!.globalAlpha = palette.isManga ? 0.18 : 0.28;
		ctx!.lineWidth = 2;

		for (const r of [radius, radius * 0.88, radius * 0.58, radius * 0.28]) {
			ctx!.beginPath();
			ctx!.arc(0, 0, r, 0, Math.PI * 2);
			ctx!.stroke();
		}

		for (let rot = 0; rot < 2; rot++) {
			ctx!.save();
			ctx!.rotate((rot * Math.PI) / 4);
			const s = radius * 0.88 * Math.SQRT1_2;
			ctx!.strokeRect(-s, -s, s * 2, s * 2);
			ctx!.restore();
		}

		for (let i = 0; i < 8; i++) {
			const angle = (i * Math.PI) / 4;
			const nx = Math.cos(angle) * radius * 0.88;
			const ny = Math.sin(angle) * radius * 0.88;
			ctx!.beginPath();
			ctx!.moveTo(Math.cos(angle) * radius * 0.28, Math.sin(angle) * radius * 0.28);
			ctx!.lineTo(nx, ny);
			ctx!.stroke();

			ctx!.fillStyle = palette.secondaryAccent;
			ctx!.beginPath();
			ctx!.arc(nx, ny, 5, 0, Math.PI * 2);
			ctx!.fill();
		}
		ctx!.restore();
	}

	function drawAnimeNekoMascot(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		const halo = ctx!.createRadialGradient(0, 0, 10, 0, 0, 95);
		halo.addColorStop(
			0,
			palette.isLight ? 'rgba(255, 158, 187, 0.35)' : 'rgba(255, 140, 198, 0.28)'
		);
		halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx!.fillStyle = halo;
		ctx!.beginPath();
		ctx!.arc(0, 0, 95, 0, Math.PI * 2);
		ctx!.fill();

		const bodyColor = palette.isManga ? '#16131c' : '#1e1633';
		const earInner = palette.accent;
		const outline = palette.isManga ? '#16131c' : palette.accent;

		ctx!.strokeStyle = bodyColor;
		ctx!.lineWidth = 12;
		ctx!.lineCap = 'round';
		ctx!.beginPath();
		ctx!.moveTo(32, 48);
		ctx!.bezierCurveTo(68, 44, 76, 4, 52, -12);
		ctx!.stroke();

		ctx!.fillStyle = bodyColor;
		ctx!.strokeStyle = outline;
		ctx!.lineWidth = 2.5;
		ctx!.beginPath();
		ctx!.ellipse(0, 34, 34, 28, 0, 0, Math.PI * 2);
		ctx!.fill();
		ctx!.stroke();

		ctx!.beginPath();
		ctx!.arc(0, -4, 36, 0, Math.PI * 2);
		ctx!.fill();
		ctx!.stroke();

		for (const dir of [-1, 1]) {
			ctx!.fillStyle = bodyColor;
			ctx!.beginPath();
			ctx!.moveTo(dir * 12, -32);
			ctx!.lineTo(dir * 34, -64);
			ctx!.lineTo(dir * 34, -18);
			ctx!.closePath();
			ctx!.fill();
			ctx!.stroke();

			ctx!.fillStyle = earInner;
			ctx!.globalAlpha = 0.75;
			ctx!.beginPath();
			ctx!.moveTo(dir * 16, -31);
			ctx!.lineTo(dir * 30, -54);
			ctx!.lineTo(dir * 30, -22);
			ctx!.closePath();
			ctx!.fill();
			ctx!.globalAlpha = 1;
		}

		ctx!.fillStyle = '#ffd166';
		ctx!.beginPath();
		ctx!.arc(0, -20, 6.5, 0.2 * Math.PI, 1.8 * Math.PI);
		ctx!.fill();

		ctx!.strokeStyle = '#fff8fb';
		ctx!.lineWidth = 3.2;
		for (const dir of [-1, 1]) {
			ctx!.beginPath();
			ctx!.arc(dir * 14, -4, 7, Math.PI * 1.15, Math.PI * 1.85);
			ctx!.stroke();
			ctx!.fillStyle = '#ff7aa8';
			ctx!.globalAlpha = 0.65;
			ctx!.beginPath();
			ctx!.ellipse(dir * 21, 5, 6, 3.2, 0, 0, Math.PI * 2);
			ctx!.fill();
			ctx!.globalAlpha = 1;
		}

		ctx!.strokeStyle = '#ffd166';
		ctx!.lineWidth = 2.2;
		ctx!.beginPath();
		ctx!.moveTo(-6, 5);
		ctx!.quadraticCurveTo(-3, 9, 0, 5);
		ctx!.quadraticCurveTo(3, 9, 6, 5);
		ctx!.stroke();

		ctx!.strokeStyle = '#e63956';
		ctx!.lineWidth = 5;
		ctx!.beginPath();
		ctx!.moveTo(-22, 18);
		ctx!.quadraticCurveTo(0, 25, 22, 18);
		ctx!.stroke();
		ctx!.fillStyle = '#ffd166';
		ctx!.beginPath();
		ctx!.arc(0, 23, 6, 0, Math.PI * 2);
		ctx!.fill();

		roundBox(-122, -66, 92, 30, palette.badgeBg, 15);
		ctx!.strokeStyle = palette.accent;
		ctx!.lineWidth = 1.5;
		ctx!.beginPath();
		ctx!.roundRect(-122, -66, 92, 30, 15);
		ctx!.stroke();
		text('Cố lên! ✦', -76, -45, 14, palette.badgeInk, 700, FONT, 'center');

		ctx!.restore();
	}

	function drawKitsuneMascot(cx: number, cy: number, scale: number): void {
		ctx!.save();
		ctx!.translate(cx, cy);
		ctx!.scale(scale, scale);

		for (const [fx, fy] of [
			[-64, -28],
			[66, -18],
			[-52, 36]
		] as const) {
			const fire = ctx!.createRadialGradient(fx, fy, 2, fx, fy, 18);
			fire.addColorStop(0, '#ffffff');
			fire.addColorStop(0.4, palette.secondaryAccent);
			fire.addColorStop(1, 'rgba(0,0,0,0)');
			ctx!.fillStyle = fire;
			ctx!.beginPath();
			ctx!.arc(fx, fy, 18, 0, Math.PI * 2);
			ctx!.fill();
		}

		ctx!.fillStyle = '#fff9f2';
		ctx!.strokeStyle = '#d62839';
		ctx!.lineWidth = 3;
		ctx!.beginPath();
		ctx!.moveTo(0, -40);
		ctx!.quadraticCurveTo(42, -32, 38, 8);
		ctx!.quadraticCurveTo(26, 36, 0, 48);
		ctx!.quadraticCurveTo(-26, 36, -38, 8);
		ctx!.quadraticCurveTo(-42, -32, 0, -40);
		ctx!.closePath();
		ctx!.fill();
		ctx!.stroke();

		for (const dir of [-1, 1]) {
			ctx!.fillStyle = '#fff9f2';
			ctx!.beginPath();
			ctx!.moveTo(dir * 12, -34);
			ctx!.lineTo(dir * 38, -68);
			ctx!.lineTo(dir * 36, -16);
			ctx!.closePath();
			ctx!.fill();
			ctx!.stroke();

			ctx!.fillStyle = '#d62839';
			ctx!.beginPath();
			ctx!.moveTo(dir * 17, -34);
			ctx!.lineTo(dir * 33, -58);
			ctx!.lineTo(dir * 31, -22);
			ctx!.closePath();
			ctx!.fill();
		}

		ctx!.strokeStyle = '#16131c';
		ctx!.lineWidth = 3.2;
		for (const dir of [-1, 1]) {
			ctx!.beginPath();
			ctx!.moveTo(dir * 10, -4);
			ctx!.quadraticCurveTo(dir * 18, -12, dir * 27, -6);
			ctx!.stroke();

			ctx!.strokeStyle = '#d62839';
			ctx!.lineWidth = 2.4;
			ctx!.beginPath();
			ctx!.moveTo(dir * 18, 12);
			ctx!.lineTo(dir * 32, 8);
			ctx!.moveTo(dir * 16, 20);
			ctx!.lineTo(dir * 30, 18);
			ctx!.stroke();
			ctx!.strokeStyle = '#16131c';
			ctx!.lineWidth = 3.2;
		}

		ctx!.fillStyle = '#d62839';
		ctx!.beginPath();
		ctx!.arc(0, -18, 6.5, 0, Math.PI * 2);
		ctx!.fill();

		ctx!.restore();
	}

	function drawOuterFrame(): void {
		const inset = phone ? 30 : 42;
		const frameW = model.width - inset * 2;
		const frameH = model.height - inset * 2;
		ctx!.save();
		ctx!.strokeStyle = palette.line;
		ctx!.globalAlpha = palette.isManga ? 0.85 : 0.42;
		ctx!.lineWidth = palette.isManga ? 3 : 1.5;
		ctx!.strokeRect(inset, inset, frameW, frameH);

		ctx!.strokeStyle = palette.accent;
		ctx!.globalAlpha = 0.9;
		ctx!.lineWidth = 3.5;
		const cornerLen = phone ? 28 : 38;
		const corners = [
			[inset, inset, 1, 1],
			[inset + frameW, inset, -1, 1],
			[inset, inset + frameH, 1, -1],
			[inset + frameW, inset + frameH, -1, -1]
		] as const;
		for (const [cx, cy, dx, dy] of corners) {
			ctx!.beginPath();
			ctx!.moveTo(cx + dx * cornerLen, cy);
			ctx!.lineTo(cx, cy);
			ctx!.lineTo(cx, cy + dy * cornerLen);
			ctx!.stroke();
		}
		ctx!.restore();
	}

	function drawHeader(topY: number): void {
		const headerTag = exams ? '✦ CHIẾN DỊCH MÙA THI ✦' : '✦ NHẬT KÝ LỊCH HỌC ✦';
		const subTag = WALLPAPER_THEMES[model.theme].subTag;

		ctx!.save();
		if (!palette.isLight) {
			ctx!.shadowColor = 'rgba(0, 0, 0, 0.85)';
			ctx!.shadowBlur = 14;
		}
		text(`BK / ALENDAR   ${headerTag}`, margin, topY, phone ? 22 : 23, palette.accent, 700, MONO);
		ctx!.restore();

		// Right-aligned Vietnamese Lucky Stamp ("QUA MÔN" / "ĐẠT A+")
		const sealLine1 = exams ? 'QUA' : 'ĐẠT';
		const sealLine2 = exams ? 'MÔN' : 'A+';
		const sealSize = phone ? 56 : 62;
		const sealX = model.width - margin - sealSize;
		const sealY = topY - (phone ? 32 : 34);

		ctx!.save();
		roundBox(sealX, sealY, sealSize, sealSize, palette.sealBg, 12);
		ctx!.strokeStyle = palette.sealInk;
		ctx!.lineWidth = 2;
		ctx!.strokeRect(sealX + 5, sealY + 5, sealSize - 10, sealSize - 10);
		text(
			sealLine1,
			sealX + sealSize / 2,
			sealY + sealSize * 0.44,
			phone ? 15 : 16,
			palette.sealInk,
			700,
			FONT,
			'center'
		);
		text(
			sealLine2,
			sealX + sealSize / 2,
			sealY + sealSize * 0.78,
			phone ? 15 : 16,
			palette.sealInk,
			700,
			FONT,
			'center'
		);
		ctx!.restore();

		ctx!.save();
		if (!palette.isLight) {
			ctx!.shadowColor = 'rgba(0, 0, 0, 0.85)';
			ctx!.shadowBlur = 14;
		}
		text(
			`HỌC KỲ ${model.semester}`,
			sealX - 18,
			topY - 2,
			phone ? 22 : 24,
			palette.ink,
			700,
			MONO,
			'right'
		);
		text(subTag, sealX - 18, topY + 26, phone ? 16 : 17, palette.muted, 600, MONO, 'right');
		ctx!.restore();

		// Main Vietnamese Title with crisp dark halo + theme glow (no overlapping English watermark)
		ctx!.save();
		if (!palette.isLight) {
			ctx!.shadowColor = 'rgba(0, 0, 0, 0.88)';
			ctx!.shadowBlur = 22;
		}
		text(model.title, margin, topY + (phone ? 98 : 108), phone ? 64 : 86, palette.ink, 700);
		ctx!.restore();

		// Subtitle + Vietnamese Motto Pill
		const subY = topY + (phone ? 156 : 168);
		ctx!.save();
		if (!palette.isLight) {
			ctx!.shadowColor = 'rgba(0, 0, 0, 0.88)';
			ctx!.shadowBlur = 14;
		}
		text(model.subtitle, margin, subY, phone ? 24 : 26, palette.ink, 600);
		ctx!.restore();

		if (model.motto) {
			const mottoText = `✦ ${model.motto}`;
			ctx!.font = `600 ${phone ? 20 : 22}px ${FONT}`;
			const mottoW = Math.min(width, ctx!.measureText(mottoText).width + 36);
			const mottoY = subY + (phone ? 18 : 16);
			roundBox(
				margin,
				mottoY,
				mottoW,
				phone ? 40 : 42,
				palette.isLight ? palette.badgeBg : 'rgba(10, 14, 26, 0.76)',
				20
			);
			ctx!.save();
			ctx!.strokeStyle = palette.accent;
			ctx!.globalAlpha = 0.72;
			ctx!.lineWidth = 1.5;
			ctx!.beginPath();
			ctx!.roundRect(margin, mottoY, mottoW, phone ? 40 : 42, 20);
			ctx!.stroke();
			ctx!.restore();
			text(
				mottoText,
				margin + 18,
				mottoY + (phone ? 27 : 28),
				phone ? 20 : 21,
				palette.badgeInk,
				600
			);
		}
	}

	function drawFooter(): void {
		const lineY = model.height - (phone ? 124 : 88);
		ctx!.save();
		ctx!.fillStyle = palette.line;
		ctx!.globalAlpha = 0.65;
		ctx!.fillRect(margin, lineY, width, 1.5);
		ctx!.restore();

		const footerY = model.height - (phone ? 72 : 42);
		text(
			'BKalendar Next ✦ Xử lý cục bộ trên thiết bị của bạn',
			margin,
			footerY,
			phone ? 19 : 20,
			palette.muted,
			500
		);
		text(
			`${model.events.length} ${exams ? 'ca thi' : 'buổi học'}  ·  UTC+07`,
			model.width - margin,
			footerY,
			phone ? 19 : 20,
			palette.accent,
			600,
			MONO,
			'right'
		);
	}

	function text(
		value: string,
		x: number,
		y: number,
		size: number,
		color: string,
		weight = 400,
		font = FONT,
		align: CanvasTextAlign = 'left'
	): void {
		ctx!.font = `${weight} ${size}px ${font}`;
		ctx!.fillStyle = color;
		ctx!.textAlign = align;
		ctx!.textBaseline = 'alphabetic';
		ctx!.fillText(value, x, y);
	}

	function roundBox(x: number, y: number, w: number, h: number, fill: string, radius = 18): void {
		ctx!.fillStyle = fill;
		ctx!.beginPath();
		ctx!.roundRect(x, y, w, h, radius);
		ctx!.fill();
	}

	function drawAnimeCardShell(
		x: number,
		y: number,
		w: number,
		h: number,
		accent: string,
		radius = 18
	): void {
		ctx!.save();
		if (palette.isManga) {
			roundBox(x + 6, y + 6, w, h, '#16131c', radius);
		} else {
			ctx!.shadowColor = 'rgba(0, 0, 0, 0.45)';
			ctx!.shadowBlur = 18;
			ctx!.shadowOffsetY = 6;
		}
		roundBox(
			x,
			y,
			w,
			h,
			model.customBackground && !palette.isLight ? 'rgba(10, 14, 24, 0.78)' : palette.card,
			radius
		);
		ctx!.shadowColor = 'transparent';
		ctx!.shadowBlur = 0;
		ctx!.shadowOffsetY = 0;

		const cardGlow = ctx!.createLinearGradient(x, y, x + w * 0.85, y + h);
		cardGlow.addColorStop(0, `${accent}28`);
		cardGlow.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
		ctx!.fillStyle = cardGlow;
		ctx!.beginPath();
		ctx!.roundRect(x, y, w, h, radius);
		ctx!.fill();

		ctx!.strokeStyle = palette.isManga ? '#16131c' : palette.cardBorder;
		ctx!.lineWidth = palette.isManga ? 2.5 : 1.5;
		ctx!.beginPath();
		ctx!.roundRect(x, y, w, h, radius);
		ctx!.stroke();

		roundBox(x + 2, y + 18, 6, Math.max(24, h - 36), accent, 3);

		ctx!.strokeStyle = accent;
		ctx!.lineWidth = 2.5;
		ctx!.beginPath();
		ctx!.moveTo(x + w - 24, y + 8);
		ctx!.lineTo(x + w - 8, y + 8);
		ctx!.lineTo(x + w - 8, y + 24);
		ctx!.stroke();
		ctx!.restore();
	}

	function lines(
		value: string,
		x: number,
		y: number,
		maxWidth: number,
		size: number,
		maxLines: number,
		color: string,
		weight = 600
	): number {
		ctx!.font = `${weight} ${size}px ${FONT}`;
		const visible = wrapWallpaperText(value, maxWidth, (t) => ctx!.measureText(t).width, maxLines);
		for (let index = 0; index < visible.length; index++) {
			text(visible[index]!, x, y + index * size * 1.34, size, color, weight);
		}
		return visible.length * size * 1.34;
	}

	function time(event: ManagedEvent): string {
		const formatter = new Intl.DateTimeFormat('vi-VN', {
			timeZone: TIME_ZONE,
			hour: '2-digit',
			minute: '2-digit'
		});
		return `${formatter.format(new Date(event.start))}–${formatter.format(new Date(event.end))}`;
	}

	function detail(event: ManagedEvent): string {
		const code = event.courseCode && event.courseCode !== event.title ? event.courseCode : '';
		return [code, event.group].filter(Boolean).join(' / ');
	}

	function locationText(event: ManagedEvent): string {
		const room = event.location || 'Chưa có phòng';
		const campus = event.metadata?.campus;
		return campus && !room.includes(campus) ? `📍 ${room} · ${campus}` : `📍 ${room}`;
	}

	function drawEvent(
		event: ManagedEvent,
		x: number,
		y: number,
		w: number,
		h: number,
		compact = false
	): void {
		const accent = colorForId(event.colorId ?? '7').background;
		drawAnimeCardShell(x, y, w, h, accent, 18);
		const size = compact ? 22 : 25;
		text(time(event), x + 24, y + 38, size, palette.accent, 600, MONO);
		const titleHeight = lines(
			`${event.icon ? `${event.icon} ` : ''}${event.title}`,
			x + 24,
			y + 80,
			w - 44,
			size + 2,
			2,
			palette.ink,
			700
		);
		lines(detail(event), x + 24, y + 88 + titleHeight, w - 44, size - 4, 1, palette.muted, 500);
		lines(
			locationText(event),
			x + 24,
			y + h - 22,
			w - 44,
			size - 3,
			1,
			palette.secondaryAccent,
			500
		);
	}

	function drawDesktopWeek(contentTop: number, contentHeight: number): void {
		const gap = 18;
		const col = (width - gap * 6) / 7;
		for (let day = 2; day <= 8; day++) {
			const x = margin + (day - 2) * (col + gap);
			const events = model.events.filter((event) => event.weekday === day);
			const dayLabel = day === 8 ? 'CHỦ NHẬT' : `THỨ ${day}`;

			// Frosted glass day header pill so day labels stand out over any anime wallpaper
			roundBox(
				x,
				contentTop,
				col,
				42,
				palette.isLight ? 'rgba(255, 255, 255, 0.82)' : 'rgba(10, 14, 24, 0.72)',
				12
			);
			ctx!.save();
			ctx!.strokeStyle = events.length ? palette.accent : palette.cardBorder;
			ctx!.globalAlpha = events.length ? 0.75 : 0.35;
			ctx!.lineWidth = 1.5;
			ctx!.beginPath();
			ctx!.roundRect(x, contentTop, col, 42, 12);
			ctx!.stroke();
			ctx!.restore();

			text(
				`✦ ${dayLabel}`,
				x + 14,
				contentTop + 28,
				20,
				events.length ? palette.accent : palette.muted,
				700,
				MONO
			);
			const h = Math.min(
				250,
				(contentHeight - 66 - Math.max(0, events.length - 1) * 16) / Math.max(1, events.length)
			);
			if (h < 205)
				throw new Error(
					'Một ngày có quá nhiều buổi học để đọc rõ. Hãy chọn hình nền điện thoại hoặc rút gọn lịch.'
				);
			if (!events.length) {
				roundBox(
					x,
					contentTop + 58,
					col,
					56,
					palette.isLight ? 'rgba(255, 255, 255, 0.52)' : 'rgba(10, 14, 24, 0.42)',
					14
				);
				text('✦ Nghỉ ngơi', x + 16, contentTop + 94, 21, palette.muted, 600);
			}
			events.forEach((event, index) =>
				drawEvent(event, x, contentTop + 58 + index * (h + 16), col, h, true)
			);
		}
	}

	function drawPhoneWeek(contentTop: number, contentHeight: number): void {
		const days = [...new Set(model.events.map((event) => event.weekday))].sort((a, b) => a - b);
		const gaps = (days.length - 1) * 20;
		const rowHeight = Math.min(
			188,
			(contentHeight - gaps - days.length * 38) / model.events.length
		);
		if (rowHeight < 130)
			throw new Error(
				'Tuần này có quá nhiều buổi để đọc rõ trên điện thoại. Hãy chọn hình nền máy tính.'
			);
		let y = contentTop;
		for (const day of days) {
			const dayEvents = model.events.filter((event) => event.weekday === day);
			text(
				`✦ ${day === 8 ? 'CHỦ NHẬT' : `THỨ ${day}`}`,
				margin,
				y + 22,
				22,
				palette.accent,
				700,
				MONO
			);
			y += 38;
			for (const event of dayEvents) {
				const accent = colorForId(event.colorId ?? '7').background;
				drawAnimeCardShell(margin, y, width, rowHeight - 10, accent, 16);
				const timeX = margin + 24;
				text(time(event), timeX, y + 39, 23, palette.accent, 600, MONO);
				lines(locationText(event), timeX, y + 76, 250, 20, 2, palette.secondaryAccent, 500);
				const textX = margin + 306;
				lines(
					`${event.icon ? `${event.icon} ` : ''}${event.title}`,
					textX,
					y + 39,
					width - 332,
					26,
					2,
					palette.ink,
					700
				);
				lines(detail(event), textX, y + rowHeight - 28, width - 332, 20, 1, palette.muted, 500);
				y += rowHeight;
			}
			y += 20;
		}
	}

	function drawExams(contentTop: number, contentHeight: number): void {
		const count = model.events.length;
		const cols = phone ? (count >= 2 ? 2 : 1) : count > 9 ? 4 : 3;
		const rows = Math.ceil(count / cols);
		const gap = phone ? 18 : 24;
		const w = (width - (cols - 1) * gap) / cols;
		const h = Math.min(phone ? 268 : 320, (contentHeight - (rows - 1) * gap) / rows);
		if (h < 220)
			throw new Error(
				'Có quá nhiều ca thi để đọc rõ trong một ảnh. Hãy chọn khổ máy tính hoặc xuất lịch .ics.'
			);
		const gridHeight = rows * h + (rows - 1) * gap;
		const startY = contentTop + Math.max(0, contentHeight - gridHeight);
		for (let index = 0; index < count; index++) {
			const event = model.events[index]!;
			const x = margin + (index % cols) * (w + gap);
			const y = startY + Math.floor(index / cols) * (h + gap);
			const accent = colorForId(event.colorId ?? '7').background;
			drawAnimeCardShell(x, y, w, h, accent, 20);

			const date = new Intl.DateTimeFormat('vi-VN', {
				timeZone: TIME_ZONE,
				weekday: 'short',
				day: '2-digit',
				month: '2-digit',
				year: 'numeric'
			}).format(new Date(event.start));
			text(date, x + 26, y + 40, cols === 2 && phone ? 22 : 25, palette.accent, 700);

			const examType = (event.metadata?.examType ?? '').toUpperCase();
			if (examType) {
				const isFinal = examType === 'CK' || examType.includes('CUỐI');
				const badgeLabel = isFinal ? '★ CUỐI KỲ' : '✦ GIỮA KỲ';
				const badgeW = cols === 2 && phone ? 118 : 136;
				const badgeX = x + w - badgeW - 18;
				roundBox(badgeX, y + 16, badgeW, 32, isFinal ? palette.sealBg : palette.badgeBg, 16);
				text(
					badgeLabel,
					badgeX + badgeW / 2,
					y + 37,
					cols === 2 && phone ? 15 : 16,
					isFinal ? palette.sealInk : palette.badgeInk,
					700,
					MONO,
					'center'
				);
			}

			text(
				`⏰ ${time(event)}`,
				x + 26,
				y + 78,
				cols === 2 && phone ? 21 : 23,
				palette.muted,
				600,
				MONO
			);
			const cleanExamTitle = event.title.replace(
				/^(?:GK|CK|Giữa\s*k[ỳì]|Cuối\s*k[ỳì])\s*·\s*/iu,
				''
			);
			lines(
				`${event.icon ? `${event.icon} ` : ''}${cleanExamTitle}`,
				x + 26,
				y + 122,
				w - 52,
				phone ? 26 : 30,
				2,
				palette.ink,
				700
			);
			lines(
				detail(event),
				x + 26,
				y + h - 64,
				w - 52,
				cols === 2 && phone ? 19 : 21,
				1,
				palette.muted,
				500
			);
			lines(
				locationText(event),
				x + 26,
				y + h - 26,
				w - 52,
				cols === 2 && phone ? 20 : 22,
				1,
				palette.secondaryAccent,
				600
			);
		}
	}
}

export async function downloadWallpaper(
	canvas: HTMLCanvasElement,
	filename: string
): Promise<void> {
	const blob = await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob(
			(value) => (value ? resolve(value) : reject(new Error('Không thể mã hóa ảnh PNG.'))),
			'image/png'
		)
	);
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.append(anchor);
	anchor.click();
	window.setTimeout(() => {
		anchor.remove();
		URL.revokeObjectURL(url);
	}, 1_000);
}
