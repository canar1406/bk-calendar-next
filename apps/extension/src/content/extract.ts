import type { SourceKind } from '../../../../packages/timetable/src/index.ts';

export type CaptureCompleteness =
	| { state: 'complete'; parsedRows: number; expectedRows: number }
	| { state: 'incomplete'; parsedRows: number; expectedRows: number }
	| { state: 'unknown'; parsedRows: number };

export interface MyBkCapture {
	raw: string;
	sourceKind?: SourceKind;
	sourceUpdatedAt?: string;
	completeness: CaptureCompleteness;
}

const EXPECTED_HEADERS = [
	'học kỳ',
	'mã mh',
	'tên môn học',
	'tín chỉ',
	'tc học phí',
	'nhóm - tổ',
	'thứ',
	'tiết',
	'giờ học',
	'phòng',
	'cơ sở',
	'tuần học'
];

export function extractMyBkTableFromDocument(source: Document | string): MyBkCapture {
	const capture = extractTimetableFromDocument(source, 'student-2024');
	if (capture.sourceKind !== 'student-2024') {
		throw new Error('Trang hiện tại không phải bảng thời khóa biểu sinh viên MyBK mới.');
	}
	return capture;
}

export function extractTimetableFromDocument(
	source: Document | string,
	requestedSourceKind: SourceKind | 'auto' = 'auto'
): MyBkCapture & { sourceKind: SourceKind } {
	const html = typeof source === 'string' ? source : source.documentElement.outerHTML;
	const text = decodeHtml(stripTags(html));
	const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];

	for (const table of tables) {
		const rows = parseRows(table[1] ?? '');
		if (rows.length < 2) continue;
		const headers = rows[0]?.map(normalize) ?? [];
		const sourceKind = detectSourceKind(headers);
		if (!sourceKind || (requestedSourceKind !== 'auto' && sourceKind !== requestedSourceKind)) {
			continue;
		}
		const headerIndexes = SOURCE_HEADERS[sourceKind].map((header) =>
			headers.findIndex((value) => matchesHeader(value, header))
		);
		const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));
		const canonicalRows = dataRows.map((row) => headerIndexes.map((index) => row[index] ?? ''));
		const sourceUpdatedAt = sourceKind === 'student-2024' ? parseUpdatedAt(text) : undefined;
		const completeness = parseCompleteness(text, canonicalRows.length, sourceKind);

		return {
			sourceKind,
			raw: [
				...buildPrefix(sourceKind, text, canonicalRows),
				SOURCE_HEADERS[sourceKind].map(toDisplayHeader).join('\t'),
				...canonicalRows.map((row) => row.join('\t')),
				completenessFooter(sourceKind, canonicalRows.length, completeness)
			]
				.join('\n')
				.trim(),
			...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
			completeness
		};
	}

	throw new Error(
		'Không tìm thấy bảng thời khóa biểu của nguồn đã chọn. Hãy mở đúng trang lịch và đăng nhập lại nếu cần.'
	);
}

export function isLikelyExpiredSession(source: Document | string): boolean {
	const html = typeof source === 'string' ? source : source.documentElement.outerHTML;
	if (/<table\b[^>]*>/iu.test(html)) return false;
	const text = decodeHtml(stripTags(html));
	return /phiên(?: đăng nhập)?[^.]{0,80}(?:hết hạn|expired)|session[^.]{0,80}expired|token[^.]{0,80}(?:hết hạn|expired)|\b(?:đăng nhập|login|cas)\b/iu.test(
		text
	);
}

const SOURCE_HEADERS: Record<SourceKind, string[]> = {
	'student-2024': EXPECTED_HEADERS,
	'student-legacy': [
		'mã mh',
		'tên môn học',
		'tín chỉ',
		'tc học phí',
		'nhóm-tổ',
		'thứ',
		'tiết',
		'giờ học',
		'phòng',
		'cơ sở',
		'tuần học'
	],
	lecturer: ['lớp', 'tên mh', 'phòng', 'dãy', 'thứ', 'số tiết', 'tiết', 'giờ', 'tuần học', '% nd'],
	postgraduate: [
		'cán bộ giảng dạy',
		'môn học',
		'lớp/ds lớp',
		'thứ',
		'tiết bắt đầu',
		'tiết kết thúc',
		'phòng',
		'tuần',
		'ghi chú'
	]
};

function detectSourceKind(headers: string[]): SourceKind | undefined {
	return (Object.keys(SOURCE_HEADERS) as SourceKind[]).find((sourceKind) =>
		SOURCE_HEADERS[sourceKind].every((header) =>
			headers.some((value) => matchesHeader(value, header))
		)
	);
}

function buildPrefix(sourceKind: SourceKind, text: string, rows: string[][]): string[] {
	switch (sourceKind) {
		case 'student-2024': {
			const sourceUpdatedAt = parseUpdatedAt(text);
			return [
				`${rows[0]?.[0] ?? ''} - ${semesterLabel(rows[0]?.[0] ?? '')}`,
				sourceUpdatedAt
					? `Ngày cập nhật gần nhất của HK này: ${toVietnameseTimestamp(sourceUpdatedAt)}`
					: '',
				'Trình bày',
				String(rows.length),
				' dòng/trang',
				'Tìm kiếm:'
			].filter(Boolean);
		}
		case 'student-legacy': {
			const semester = text.match(/Học kỳ\s+([123])\s+Năm học\s+(\d{4})\s*-\s*(\d{4})/iu);
			if (!semester) throw new Error('Không tìm thấy học kỳ của lịch sinh viên cũ.');
			return [`Học kỳ ${semester[1]} Năm học ${semester[2]} - ${semester[3]}`, 'Ngày cập nhật:'];
		}
		case 'lecturer': {
			const year = text.match(/Năm học\s+(\d{4})/iu)?.[1];
			const term = text.match(/Học kỳ\s+([123])/iu)?.[1];
			if (!year || !term) throw new Error('Không tìm thấy học kỳ của lịch giảng viên.');
			return [`Năm học ${year}`, `Học kỳ ${term}`];
		}
		case 'postgraduate': {
			const semester = text.match(
				/Học kỳ\s+([123])\/(\d{4})-(\d{4}):\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*\(Tuần\s+\d+\)/iu
			);
			if (!semester) throw new Error('Không tìm thấy học kỳ của lịch sau đại học.');
			return [
				`Học kỳ ${semester[1]}/${semester[2]}-${semester[3]}: ${semester[4]} (Tuần 1)`,
				'',
				'',
				''
			];
		}
	}
}

function completenessFooter(
	sourceKind: SourceKind,
	parsedRows: number,
	completeness: CaptureCompleteness
): string {
	if (sourceKind === 'student-2024') {
		return `Trình bày từ dòng 1 đến ${parsedRows} / ${expectedCount(completeness)} dòng`;
	}
	if (sourceKind === 'lecturer' && completeness.state !== 'unknown') {
		return `Đang xem 1 đến ${parsedRows} trong tổng số ${completeness.expectedRows} mục`;
	}
	return '';
}

function parseRows(tableHtml: string): string[][] {
	return [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
		[...(match[1] ?? '').matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) =>
			decodeHtml(stripTags(cell[1] ?? ''))
				.replace(/\s+/g, ' ')
				.trim()
		)
	);
}

function stripTags(value: string): string {
	return value
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value: string): string {
	const named: Record<string, string> = {
		amp: '&',
		lt: '<',
		gt: '>',
		quot: '"',
		apos: "'",
		nbsp: ' '
	};
	return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity: string) => {
		if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
		if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
		return named[entity.toLowerCase()] ?? `&${entity};`;
	});
}

function normalize(value: string): string {
	return value.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
}

function matchesHeader(value: string, expected: string): boolean {
	return value === expected || value.startsWith(`${expected} `) || value.startsWith(`${expected}⇅`);
}

function toDisplayHeader(header: string): string {
	return header.toLocaleUpperCase('vi');
}

function parseUpdatedAt(text: string): string | undefined {
	const match = text.match(
		/Ngày cập nhật gần nhất của HK này:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/i
	);
	if (!match) return undefined;
	const [, day, month, year, hour, minute, second] = match;
	return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}T${hour!.padStart(2, '0')}:${minute}:${second}+07:00`;
}

function parseCompleteness(
	text: string,
	parsedRows: number,
	sourceKind: SourceKind
): CaptureCompleteness {
	if (sourceKind !== 'student-2024' && sourceKind !== 'lecturer') {
		return { state: 'unknown', parsedRows };
	}
	const pattern =
		sourceKind === 'lecturer'
			? /Đang xem\s+\d+\s+đến\s+\d+\s+trong tổng số\s+(\d+)\s+mục/iu
			: /Trình bày từ dòng\s+\d+\s+đến\s+\d+\s*\/\s*(\d+)\s+dòng/iu;
	const match = text.match(pattern);
	if (!match) return { state: 'unknown', parsedRows };
	const expectedRows = Number(match[1]);
	return parsedRows >= expectedRows
		? { state: 'complete', parsedRows, expectedRows }
		: { state: 'incomplete', parsedRows, expectedRows };
}

function expectedCount(completeness: CaptureCompleteness): number {
	return completeness.state === 'unknown' ? completeness.parsedRows : completeness.expectedRows;
}

function semesterLabel(code: string): string {
	const match = code.match(/^(?:20)?(\d{2})([123])$/);
	if (!match) return 'Học kỳ';
	return `Học kỳ ${match[2]} Năm học 20${match[1]} - ${Number(`20${match[1]}`) + 1}(Hiện hành)`;
}

function toVietnameseTimestamp(iso: string): string {
	const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/);
	return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}` : iso;
}
