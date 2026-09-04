export type CaptureCompleteness =
	| { state: 'complete'; parsedRows: number; expectedRows: number }
	| { state: 'incomplete'; parsedRows: number; expectedRows: number }
	| { state: 'unknown'; parsedRows: number };

export interface MyBkCapture {
	raw: string;
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
	const html = typeof source === 'string' ? source : source.documentElement.outerHTML;
	const text = decodeHtml(stripTags(html));
	const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];

	for (const table of tables) {
		const rows = parseRows(table[1] ?? '');
		if (rows.length < 2) continue;
		const headers = rows[0]?.map(normalize) ?? [];
		const headerIndexes = EXPECTED_HEADERS.map((header) =>
			headers.findIndex((value) => matchesHeader(value, header))
		);
		if (headerIndexes.some((index) => index < 0)) continue;
		const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));
		const canonicalHeader = EXPECTED_HEADERS.map(toDisplayHeader);
		const canonicalRows = dataRows.map((row) => headerIndexes.map((index) => row[index] ?? ''));
		const sourceUpdatedAt = parseUpdatedAt(text);
		const completeness = parseCompleteness(text, canonicalRows.length);
		const prefix = [
			`${canonicalRows[0]?.[0] ?? ''} - ${semesterLabel(canonicalRows[0]?.[0] ?? '')}`,
			sourceUpdatedAt
				? `Ngày cập nhật gần nhất của HK này: ${toVietnameseTimestamp(sourceUpdatedAt)}`
				: '',
			'Trình bày',
			String(canonicalRows.length),
			' dòng/trang',
			'Tìm kiếm:'
		].filter(Boolean);

		return {
			raw: [
				...prefix,
				canonicalHeader.join('\t'),
				...canonicalRows.map((row) => row.join('\t')),
				`Trình bày từ dòng 1 đến ${canonicalRows.length} / ${expectedCount(completeness)} dòng`
			].join('\n'),
			...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
			completeness
		};
	}

	throw new Error(
		'Không tìm thấy bảng thời khóa biểu MyBK. Hãy mở mục Thời khóa biểu và đăng nhập lại nếu cần.'
	);
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

function parseCompleteness(text: string, parsedRows: number): CaptureCompleteness {
	const match = text.match(/Trình bày từ dòng\s+\d+\s+đến\s+\d+\s*\/\s*(\d+)\s+dòng/i);
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
