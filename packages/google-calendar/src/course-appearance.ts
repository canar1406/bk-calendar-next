import { createPresentationFingerprint, type ManagedEvent } from '../../timetable/src/index.ts';

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
}

export interface CourseColorPalette {
	id: string;
	name: string;
	description: string;
	colorIds: string[];
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

export const COURSE_ICONS: CourseIcon[] = [
	{ value: '', label: 'Không icon', category: 'Chung' },
	{ value: '📘', label: 'Sách', category: 'Học tập' },
	{ value: '📚', label: 'Thư viện', category: 'Học tập' },
	{ value: '📝', label: 'Bài tập', category: 'Học tập' },
	{ value: '✏️', label: 'Ghi chép', category: 'Học tập' },
	{ value: '🎓', label: 'Học thuật', category: 'Học tập' },
	{ value: '🧠', label: 'Tư duy', category: 'Học tập' },
	{ value: '📊', label: 'Thống kê', category: 'Học tập' },
	{ value: '📐', label: 'Hình học', category: 'STEM' },
	{ value: '🧮', label: 'Toán', category: 'STEM' },
	{ value: '∞️', label: 'Giải tích', category: 'STEM' },
	{ value: '⚛️', label: 'Vật lý', category: 'STEM' },
	{ value: '🧪', label: 'Thí nghiệm', category: 'STEM' },
	{ value: '🔬', label: 'Phòng lab', category: 'STEM' },
	{ value: '🧬', label: 'Sinh học', category: 'STEM' },
	{ value: '🧫', label: 'Vi sinh', category: 'STEM' },
	{ value: '🌡️', label: 'Nhiệt học', category: 'STEM' },
	{ value: '💻', label: 'Lập trình', category: 'Công nghệ' },
	{ value: '⌨️', label: 'Máy tính', category: 'Công nghệ' },
	{ value: '🤖', label: 'Robot', category: 'Công nghệ' },
	{ value: '🛰️', label: 'Viễn thông', category: 'Công nghệ' },
	{ value: '🌐', label: 'Mạng máy tính', category: 'Công nghệ' },
	{ value: '🔐', label: 'Bảo mật', category: 'Công nghệ' },
	{ value: '🗄️', label: 'Cơ sở dữ liệu', category: 'Công nghệ' },
	{ value: '🛠️', label: 'Kỹ thuật', category: 'Kỹ thuật' },
	{ value: '⚙️', label: 'Cơ khí', category: 'Kỹ thuật' },
	{ value: '🔌', label: 'Điện', category: 'Kỹ thuật' },
	{ value: '🔧', label: 'Chế tạo', category: 'Kỹ thuật' },
	{ value: '🏗️', label: 'Xây dựng', category: 'Kỹ thuật' },
	{ value: '📡', label: 'Tín hiệu', category: 'Kỹ thuật' },
	{ value: '🚗', label: 'Ô tô', category: 'Kỹ thuật' },
	{ value: '✈️', label: 'Hàng không', category: 'Kỹ thuật' },
	{ value: '💼', label: 'Kinh doanh', category: 'Kinh tế' },
	{ value: '💰', label: 'Tài chính', category: 'Kinh tế' },
	{ value: '📈', label: 'Kinh tế', category: 'Kinh tế' },
	{ value: '⚖️', label: 'Pháp luật', category: 'Xã hội' },
	{ value: '🌏', label: 'Địa lý', category: 'Xã hội' },
	{ value: '🏛️', label: 'Chính trị', category: 'Xã hội' },
	{ value: '🗣️', label: 'Ngoại ngữ', category: 'Xã hội' },
	{ value: '🎨', label: 'Thiết kế', category: 'Sáng tạo' },
	{ value: '📸', label: 'Nhiếp ảnh', category: 'Sáng tạo' },
	{ value: '🎵', label: 'Âm nhạc', category: 'Sáng tạo' },
	{ value: '🎬', label: 'Truyền thông', category: 'Sáng tạo' },
	{ value: '🏓', label: 'Bóng bàn', category: 'Thể thao' },
	{ value: '⚽', label: 'Bóng đá', category: 'Thể thao' },
	{ value: '🏀', label: 'Bóng rổ', category: 'Thể thao' },
	{ value: '🏊', label: 'Bơi', category: 'Thể thao' },
	{ value: '🏃', label: 'Điền kinh', category: 'Thể thao' },
	{ value: '🧘', label: 'Thể chất', category: 'Thể thao' },
	{ value: '📅', label: 'Lịch học', category: 'Sự kiện' },
	{ value: '⏰', label: 'Nhắc giờ', category: 'Sự kiện' },
	{ value: '🎤', label: 'Thuyết trình', category: 'Sự kiện' },
	{ value: '📋', label: 'Kiểm tra', category: 'Sự kiện' },
	{ value: '🏁', label: 'Thi cuối kỳ', category: 'Sự kiện' },
	{ value: '🧭', label: 'Sinh hoạt', category: 'Sự kiện' },
	{ value: '📖', label: 'Sách mở', category: 'Học tập' },
	{ value: '📕', label: 'Sách đỏ', category: 'Học tập' },
	{ value: '📗', label: 'Sách xanh lá', category: 'Học tập' },
	{ value: '📙', label: 'Sách cam', category: 'Học tập' },
	{ value: '📓', label: 'Sổ tay', category: 'Học tập' },
	{ value: '📔', label: 'Sổ trang trí', category: 'Học tập' },
	{ value: '📒', label: 'Sổ cái', category: 'Học tập' },
	{ value: '📑', label: 'Đánh dấu trang', category: 'Học tập' },
	{ value: '🔖', label: 'Dấu trang', category: 'Học tập' },
	{ value: '🖊️', label: 'Bút bi', category: 'Học tập' },
	{ value: '🖋️', label: 'Bút máy', category: 'Học tập' },
	{ value: '📌', label: 'Ghim bài', category: 'Học tập' },
	{ value: '🗂️', label: 'Phân loại tài liệu', category: 'Học tập' },
	{ value: '🗃️', label: 'Hộp tài liệu', category: 'Học tập' },
	{ value: '📏', label: 'Thước', category: 'STEM' },
	{ value: '🔭', label: 'Thiên văn', category: 'Khoa học' },
	{ value: '🧲', label: 'Từ trường', category: 'Khoa học' },
	{ value: '⚗️', label: 'Hóa học', category: 'Khoa học' },
	{ value: '🧑‍🔬', label: 'Nhà khoa học', category: 'Khoa học' },
	{ value: '🪐', label: 'Hành tinh', category: 'Khoa học' },
	{ value: '🌌', label: 'Vũ trụ', category: 'Khoa học' },
	{ value: '☄️', label: 'Sao chổi', category: 'Khoa học' },
	{ value: '💡', label: 'Ý tưởng', category: 'Khoa học' },
	{ value: '🔋', label: 'Năng lượng', category: 'Khoa học' },
	{ value: '🧯', label: 'An toàn phòng lab', category: 'Khoa học' },
	{ value: '🖥️', label: 'Máy tính để bàn', category: 'Công nghệ' },
	{ value: '🖱️', label: 'Thiết bị nhập', category: 'Công nghệ' },
	{ value: '💾', label: 'Lưu trữ', category: 'Công nghệ' },
	{ value: '💿', label: 'Dữ liệu số', category: 'Công nghệ' },
	{ value: '📱', label: 'Di động', category: 'Công nghệ' },
	{ value: '🕹️', label: 'Điều khiển', category: 'Công nghệ' },
	{ value: '🎮', label: 'Phát triển game', category: 'Công nghệ' },
	{ value: '🧑‍💻', label: 'Lập trình viên', category: 'Công nghệ' },
	{ value: '☁️', label: 'Điện toán đám mây', category: 'Công nghệ' },
	{ value: '📶', label: 'Kết nối không dây', category: 'Công nghệ' },
	{ value: '🛡️', label: 'An ninh mạng', category: 'Công nghệ' },
	{ value: '🔑', label: 'Mật mã', category: 'Công nghệ' },
	{ value: '🐞', label: 'Gỡ lỗi', category: 'Công nghệ' },
	{ value: '🧩', label: 'Thuật toán', category: 'Công nghệ' },
	{ value: '🪛', label: 'Tua vít', category: 'Kỹ thuật' },
	{ value: '🪚', label: 'Gia công', category: 'Kỹ thuật' },
	{ value: '🔩', label: 'Chi tiết máy', category: 'Kỹ thuật' },
	{ value: '🧱', label: 'Vật liệu', category: 'Kỹ thuật' },
	{ value: '🏭', label: 'Công nghiệp', category: 'Kỹ thuật' },
	{ value: '🚧', label: 'Công trình', category: 'Kỹ thuật' },
	{ value: '🏢', label: 'Kiến trúc', category: 'Kỹ thuật' },
	{ value: '🌉', label: 'Cầu đường', category: 'Kỹ thuật' },
	{ value: '🛞', label: 'Động lực học', category: 'Kỹ thuật' },
	{ value: '⚡', label: 'Điện năng', category: 'Kỹ thuật' },
	{ value: '🚀', label: 'Hàng không vũ trụ', category: 'Kỹ thuật' },
	{ value: '🚁', label: 'Trực thăng', category: 'Kỹ thuật' },
	{ value: '🚢', label: 'Kỹ thuật tàu thủy', category: 'Kỹ thuật' },
	{ value: '🏦', label: 'Ngân hàng', category: 'Kinh tế' },
	{ value: '💳', label: 'Thanh toán', category: 'Kinh tế' },
	{ value: '🧾', label: 'Kế toán', category: 'Kinh tế' },
	{ value: '🪙', label: 'Tiền tệ', category: 'Kinh tế' },
	{ value: '💹', label: 'Thị trường', category: 'Kinh tế' },
	{ value: '🛒', label: 'Thương mại', category: 'Kinh tế' },
	{ value: '🏷️', label: 'Marketing', category: 'Kinh tế' },
	{ value: '🤝', label: 'Đàm phán', category: 'Kinh tế' },
	{ value: '🧑‍💼', label: 'Quản trị', category: 'Kinh tế' },
	{ value: '🏪', label: 'Bán lẻ', category: 'Kinh tế' },
	{ value: '🗺️', label: 'Bản đồ', category: 'Xã hội' },
	{ value: '🧑‍⚖️', label: 'Tư pháp', category: 'Xã hội' },
	{ value: '🗳️', label: 'Bầu cử', category: 'Xã hội' },
	{ value: '📰', label: 'Báo chí', category: 'Xã hội' },
	{ value: '📜', label: 'Lịch sử', category: 'Xã hội' },
	{ value: '🕊️', label: 'Quan hệ quốc tế', category: 'Xã hội' },
	{ value: '🏺', label: 'Khảo cổ', category: 'Xã hội' },
	{ value: '💬', label: 'Giao tiếp', category: 'Xã hội' },
	{ value: '🖌️', label: 'Hội họa', category: 'Sáng tạo' },
	{ value: '✍️', label: 'Sáng tác', category: 'Sáng tạo' },
	{ value: '🎭', label: 'Sân khấu', category: 'Sáng tạo' },
	{ value: '🎹', label: 'Piano', category: 'Sáng tạo' },
	{ value: '🎸', label: 'Guitar', category: 'Sáng tạo' },
	{ value: '🎧', label: 'Âm thanh', category: 'Sáng tạo' },
	{ value: '🎙️', label: 'Phát thanh', category: 'Sáng tạo' },
	{ value: '📺', label: 'Truyền hình', category: 'Sáng tạo' },
	{ value: '🎞️', label: 'Điện ảnh', category: 'Sáng tạo' },
	{ value: '💃', label: 'Biểu diễn', category: 'Sáng tạo' },
	{ value: '🏐', label: 'Bóng chuyền', category: 'Thể thao' },
	{ value: '🎾', label: 'Quần vợt', category: 'Thể thao' },
	{ value: '🏸', label: 'Cầu lông', category: 'Thể thao' },
	{ value: '🥋', label: 'Võ thuật', category: 'Thể thao' },
	{ value: '🥊', label: 'Quyền anh', category: 'Thể thao' },
	{ value: '🚴', label: 'Đạp xe', category: 'Thể thao' },
	{ value: '🤸', label: 'Thể dục dụng cụ', category: 'Thể thao' },
	{ value: '🏋️', label: 'Thể hình', category: 'Thể thao' },
	{ value: '🏆', label: 'Giải đấu', category: 'Thể thao' },
	{ value: '🥇', label: 'Thành tích', category: 'Thể thao' },
	{ value: '🛹', label: 'Trượt ván', category: 'Thể thao' },
	{ value: '🩺', label: 'Khám bệnh', category: 'Y khoa' },
	{ value: '💊', label: 'Dược học', category: 'Y khoa' },
	{ value: '🩻', label: 'Chẩn đoán hình ảnh', category: 'Y khoa' },
	{ value: '🏥', label: 'Bệnh viện', category: 'Y khoa' },
	{ value: '🩹', label: 'Sơ cứu', category: 'Y khoa' },
	{ value: '🦠', label: 'Vi sinh y học', category: 'Y khoa' },
	{ value: '🫀', label: 'Tim mạch', category: 'Y khoa' },
	{ value: '🫁', label: 'Hô hấp', category: 'Y khoa' },
	{ value: '🦷', label: 'Nha khoa', category: 'Y khoa' },
	{ value: '👁️', label: 'Nhãn khoa', category: 'Y khoa' },
	{ value: '🌱', label: 'Mầm xanh', category: 'Môi trường' },
	{ value: '🌿', label: 'Sinh thái', category: 'Môi trường' },
	{ value: '🌳', label: 'Lâm nghiệp', category: 'Môi trường' },
	{ value: '🌊', label: 'Hải dương', category: 'Môi trường' },
	{ value: '🌤️', label: 'Khí tượng', category: 'Môi trường' },
	{ value: '♻️', label: 'Tái chế', category: 'Môi trường' },
	{ value: '🌾', label: 'Nông nghiệp', category: 'Môi trường' },
	{ value: '🐝', label: 'Đa dạng sinh học', category: 'Môi trường' },
	{ value: '🪨', label: 'Địa chất', category: 'Môi trường' },
	{ value: '💧', label: 'Tài nguyên nước', category: 'Môi trường' },
	{ value: '🔤', label: 'Ngữ âm', category: 'Ngôn ngữ' },
	{ value: '🇬🇧', label: 'Tiếng Anh', category: 'Ngôn ngữ' },
	{ value: '🇫🇷', label: 'Tiếng Pháp', category: 'Ngôn ngữ' },
	{ value: '🇩🇪', label: 'Tiếng Đức', category: 'Ngôn ngữ' },
	{ value: '🇯🇵', label: 'Tiếng Nhật', category: 'Ngôn ngữ' },
	{ value: '🇰🇷', label: 'Tiếng Hàn', category: 'Ngôn ngữ' },
	{ value: '🇨🇳', label: 'Tiếng Trung', category: 'Ngôn ngữ' },
	{ value: '✅', label: 'Hoàn thành', category: 'Sự kiện' },
	{ value: '❗', label: 'Quan trọng', category: 'Sự kiện' },
	{ value: '📢', label: 'Thông báo', category: 'Sự kiện' },
	{ value: '🔔', label: 'Chuông nhắc', category: 'Sự kiện' },
	{ value: '🕐', label: 'Hẹn giờ', category: 'Sự kiện' },
	{ value: '🗓️', label: 'Kế hoạch', category: 'Sự kiện' },
	{ value: '🎯', label: 'Mục tiêu', category: 'Sự kiện' },
	{ value: '📎', label: 'Tài liệu đính kèm', category: 'Sự kiện' },
	{ value: '🚌', label: 'Xe buýt', category: 'Di chuyển' },
	{ value: '🚆', label: 'Tàu điện', category: 'Di chuyển' },
	{ value: '🚲', label: 'Xe đạp', category: 'Di chuyển' },
	{ value: '🛵', label: 'Xe máy', category: 'Di chuyển' },
	{ value: '📍', label: 'Địa điểm', category: 'Di chuyển' }
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
	if (!normalized || normalized.length > 12) return false;
	return (
		[...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(normalized)].length === 1
	);
}
