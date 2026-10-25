import {
	createSnapshot,
	type ManagedEvent,
	type SourceKind,
	type TimetableSnapshot
} from '../../../timetable/src/index.ts';
import type { SourceSnapshotOptions } from '../source-snapshot.ts';
import { ParseError, SemesterNotFoundError, TableNotFoundError } from './errors.ts';

const FIELDS = {
	code: ['ma mon hoc', 'ma mh', 'ma mon'],
	name: ['ten mon hoc', 'ten mh', 'mon hoc', 'ten mon'],
	group: ['nhom to', 'nhom', 'lop', 'nhom lop'],
	date: ['ngay thi', 'ngay kiem tra', 'ngay'],
	start: ['gio thi', 'gio bat dau', 'thoi gian thi', 'gio', 'thoi gian'],
	end: ['gio ket thuc', 'ket thuc'],
	duration: ['so phut', 'tong so phut', 'thoi luong', 'thoi gian lam bai'],
	room: ['phong thi', 'ma phong', 'phong', 'dia diem'],
	campus: ['co so'],
	semester: ['hoc ky', 'ma hoc ky'],
	examType: ['loai thi', 'loai', 'dot thi', 'ky thi'],
	method: ['hinh thuc thi', 'hinh thuc']
} as const;

type Field = keyof typeof FIELDS;
type Columns = Record<Field, number>;

export function isExamTableHeader(line: string): boolean {
	const columns = mapColumns(splitRow(line));
	return columns.name >= 0 && columns.date >= 0 && columns.start >= 0;
}

export function looksLikeExamSource(source: string): boolean {
	return source.split(/\r?\n/u).some(isExamTableHeader);
}

export async function createExamSnapshot(
	source: string,
	sourceKind: SourceKind,
	options: SourceSnapshotOptions = {}
): Promise<TimetableSnapshot> {
	const lines = source
		.replace(/^\uFEFF/u, '')
		.replaceAll('\r', '')
		.split('\n');
	const headerIndex = lines.findIndex(isExamTableHeader);
	if (headerIndex < 0)
		throw new TableNotFoundError('Không tìm thấy bảng lịch thi có ngày và giờ thi.');
	const columns = mapColumns(splitRow(lines[headerIndex]!));
	const semester = readExamSemester(lines, headerIndex, columns, options.semester);
	const events: Array<Omit<ManagedEvent, 'stableKey' | 'fingerprint'>> = [];
	const warnings: string[] = [];
	let parsedRows = 0;

	for (const line of lines.slice(headerIndex + 1)) {
		if (!line.trim()) continue;
		if (/^(trinh bay tu dong|trinh bay boi|dang xem|tong so|showing)\b/u.test(normalize(line)))
			break;
		if (isExamTableHeader(line)) continue;
		if (isTableSeparator(splitRow(line)) || isExamTableHeader(line)) continue;
		const cells = splitRow(line);
		if (cells.length !== splitRow(lines[headerIndex]!).length) {
			throw new ParseError(line, 'Lịch thi bị thiếu cột. Hãy sao chép toàn bộ bảng cùng tiêu đề.');
		}
		parsedRows++;
		const value = (field: Field): string => cells[columns[field]] ?? '';
		const rawTitle = value('name');
		const subject = /^([A-Za-z]{2,}\d{2,}[A-Za-z0-9]*|[A-Z]{4,10})\s*[-\u2013\u2014]\s*(.+)$/u.exec(
			rawTitle.trim()
		);
		const title = subject?.[2]?.trim() ?? rawTitle;
		if (!title) throw new ParseError(line, 'Thiếu tên môn học trong lịch thi.');
		const date = value('date');
		if (!date || date === '--' || /chua (co|xac dinh)/u.test(normalize(date))) {
			warnings.push(`${title}: chưa có ngày thi, chưa được đưa vào lịch.`);
			continue;
		}
		const dateUtc = parseDate(date);
		const timeRange = value('start').split(/\s*[-–—]\s*/u);
		if (timeRange.length > 2) throw new ParseError(line, 'Khoảng giờ thi không hợp lệ.');
		const startMinutes = parseTime(timeRange[0] ?? '');
		const explicitEnd = value('end') || timeRange[1];
		let endMinutes: number;
		if (explicitEnd) {
			endMinutes = parseTime(explicitEnd);
		} else {
			const duration = /^(\d+)(?:\s*(?:phut|p|minutes?|mins?))?$/u.exec(
				normalize(value('duration'))
			);
			const minutes = Number(duration?.[1]);
			if (!duration || !Number.isInteger(minutes) || minutes <= 0 || minutes > 720) {
				throw new ParseError(
					line,
					'Thiếu thời lượng hoặc giờ kết thúc của bài thi. Không tự đoán số phút làm bài.'
				);
			}
			endMinutes = startMinutes + minutes;
		}
		if (endMinutes <= startMinutes || endMinutes - startMinutes > 720) {
			throw new ParseError(line, 'Giờ kết thúc bài thi phải sau giờ bắt đầu, tối đa 12 giờ.');
		}
		const courseCode = value('code') || subject?.[1] || title;
		const group = value('group');
		const examType = value('examType') || 'Thi';
		events.push({
			sourceKind,
			scheduleKind: 'exams',
			semester,
			courseCode,
			group,
			sessionOrdinal: 0,
			weekday: ((new Date(dateUtc).getUTCDay() + 6) % 7) + 2,
			title: `${examType} · ${title}`,
			location: value('room'),
			start: new Date(dateUtc + (startMinutes - 420) * 60_000).toISOString(),
			end: new Date(dateUtc + (endMinutes - 420) * 60_000).toISOString(),
			timeZone: 'Asia/Ho_Chi_Minh',
			activeWeekIndexes: [0],
			excludedStarts: [],
			metadata: {
				courseCode,
				group,
				examType,
				campus: value('campus'),
				examMethod: value('method')
			}
		});
	}
	// Multiple indistinguishable sessions have no source ID. Sort copies consistently,
	// but never authorize deletion on the strength of an ambiguous capture.
	const ordinals = new Map<string, number>();
	events.sort((a, b) =>
		`${a.start}|${a.end}|${a.title}|${a.location}`.localeCompare(
			`${b.start}|${b.end}|${b.title}|${b.location}`
		)
	);
	for (const event of events) {
		const anchor = `${normalize(event.courseCode)}|${normalize(event.group)}|${normalize(event.metadata.examType ?? '')}`;
		event.sessionOrdinal = ordinals.get(anchor) ?? 0;
		ordinals.set(anchor, event.sessionOrdinal + 1);
		if (event.sessionOrdinal === 1) {
			warnings.push(
				`${event.courseCode}: nhiều ca thi cùng nhóm và loại thi, cần kiểm tra lại khi lịch thay đổi. Chưa cho phép tự xóa.`
			);
		}
	}
	return await createSnapshot({
		sourceKind,
		scheduleKind: 'exams',
		semester,
		capturedAt: options.capturedAt ?? new Date().toISOString(),
		...(options.provenance ? { provenance: options.provenance } : {}),
		completeness:
			warnings.length > 0
				? { state: 'unknown', parsedRows }
				: (options.completeness ?? { state: 'unknown', parsedRows }),
		warnings,
		events
	});
}

function splitRow(line: string): string[] {
	if (line.includes('\t')) return line.split('\t').map((cell) => cell.trim());
	const text = line.trim();
	if (text.startsWith('|') && text.endsWith('|'))
		return text
			.slice(1, -1)
			.split('|')
			.map((cell) => cell.trim());
	return [text];
}

function isTableSeparator(cells: string[]): boolean {
	return cells.length > 1 && cells.every((cell) => /^:?-+:?$/u.test(cell));
}

function mapColumns(headers: string[]): Columns {
	const normalized = headers.map(normalize);
	return Object.fromEntries(
		Object.entries(FIELDS).map(([field, aliases]) => {
			const exact = normalized.findIndex((header) => aliases.some((alias) => header === alias));
			return [
				field,
				exact >= 0
					? exact
					: normalized.findIndex((header) =>
							aliases.some((alias) => alias.includes(' ') && header.startsWith(`${alias} `))
						)
			];
		})
	) as Columns;
}

function readExamSemester(
	lines: string[],
	headerIndex: number,
	columns: Columns,
	override: number | undefined
): number {
	const semesters = new Set<number>();
	const columnCount = splitRow(lines[headerIndex]!).length;
	if (columns.semester >= 0) {
		for (const line of lines.slice(headerIndex + 1)) {
			if (isTableSeparator(splitRow(line)) || isExamTableHeader(line)) continue;
			const cells = splitRow(line);
			if (cells.length !== columnCount || !cells[columns.name]) continue;
			const value = cells[columns.semester]?.trim() ?? '';
			if (!value) continue;
			const code = /^20\d{2}[123]$/u.test(value) ? value.slice(2) : value;
			if (!/^\d{2}[123]$/u.test(code)) {
				throw new ParseError(line, 'Mã học kỳ trong lịch thi không hợp lệ.');
			}
			semesters.add(Number(code));
		}
	}
	if (semesters.size > 1) {
		throw new ParseError(
			'lịch thi',
			'Lịch thi có nhiều học kỳ. Hãy chọn một học kỳ trên MyBK rồi sao chép lại.'
		);
	}
	const rowSemester = semesters.values().next().value;
	if (rowSemester !== undefined && override === undefined) return rowSemester;
	const semester = parseSemester(lines.slice(0, headerIndex).join('\n'), override);
	if (rowSemester !== undefined && rowSemester !== semester) {
		throw new ParseError('lịch thi', 'Học kỳ được chọn không khớp với học kỳ trong bảng lịch thi.');
	}
	return semester;
}

function parseSemester(preamble: string, override: number | undefined): number {
	let semester = override;
	if (semester === undefined) {
		const label = /hoc ky\s+([123])\s+(?:nam hoc\s+)?(\d{4})\s+(\d{4})/u.exec(normalize(preamble));
		if (label) {
			if (Number(label[3]) !== Number(label[2]) + 1) {
				throw new ParseError(preamble, 'Năm học trong lịch thi không hợp lệ.');
			}
			semester = (Number(label[2]) % 100) * 10 + Number(label[1]);
		} else {
			const code = /(?:hoc ky|hk)\s+(?:20)?(\d{2}[123])\b/u.exec(normalize(preamble));
			if (code) semester = Number(code[1]);
		}
	}
	if (semester !== undefined && semester >= 20000) semester %= 1000;
	if (
		semester === undefined ||
		!Number.isInteger(semester) ||
		semester < 100 ||
		semester > 999 ||
		![1, 2, 3].includes(semester % 10)
	) {
		throw new SemesterNotFoundError(
			'Không tìm thấy học kỳ. Hãy sao chép cả tiêu đề hoặc nhập mã học kỳ, ví dụ 261.'
		);
	}
	return semester;
}

function parseDate(value: string): number {
	const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/u.exec(value);
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
	const year = Number(local?.[3] ?? iso?.[1]);
	const month = Number(local?.[2] ?? iso?.[2]);
	const day = Number(local?.[1] ?? iso?.[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		(!local && !iso) ||
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		throw new ParseError(value, 'Ngày thi không hợp lệ; cần DD/MM/YYYY hoặc YYYY-MM-DD.');
	}
	return +date;
}

function parseTime(value: string): number {
	const match = /^(?:(\d{1,2}):(\d{2})|(\d{1,2})[hg](\d{2})?)$/u.exec(normalizeTime(value));
	const hour = Number(match?.[1] ?? match?.[3]);
	const minute = Number(match?.[2] ?? match?.[4] ?? 0);
	if (!match || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
		throw new ParseError(value, 'Giờ thi không hợp lệ; cần HH:mm, ví dụ 07:30.');
	}
	return hour * 60 + minute;
}

function normalizeTime(value: string): string {
	return value.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/gu, '').replaceAll('giờ', 'h');
}

function normalize(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLocaleLowerCase('vi')
		.replaceAll('đ', 'd')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}
