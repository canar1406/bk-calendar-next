import type { SourceKind } from '../../../../packages/timetable/src/index.ts';

export const SELECTED_SOURCE_KIND_KEY = 'bkalendar-next:selected-source-kind';

export interface SourceOption {
	sourceKind: SourceKind;
	label: string;
	origin: string;
	url: string;
}

export const SOURCE_OPTIONS: readonly SourceOption[] = [
	{
		sourceKind: 'student-2024',
		label: 'Sinh viên · MyBK mới',
		origin: 'mybk.hcmut.edu.vn/app',
		url: 'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb'
	},
	{
		sourceKind: 'student-legacy',
		label: 'Sinh viên · MyBK cũ',
		origin: 'mybk.hcmut.edu.vn/stinfo',
		url: 'https://mybk.hcmut.edu.vn/stinfo'
	},
	{
		sourceKind: 'lecturer',
		label: 'Giảng viên',
		origin: 'tkb.hcmut.edu.vn',
		url: 'https://tkb.hcmut.edu.vn/'
	},
	{
		sourceKind: 'postgraduate',
		label: 'Sau đại học',
		origin: 'grad.hcmut.edu.vn',
		url: 'https://grad.hcmut.edu.vn/'
	}
];

export function isSourceKind(value: unknown): value is SourceKind {
	return SOURCE_OPTIONS.some(({ sourceKind }) => sourceKind === value);
}

export function normalizeSelectedSourceKind(value: unknown): SourceKind {
	return isSourceKind(value) ? value : 'student-2024';
}

export function sourceOptionFor(sourceKind: SourceKind): SourceOption {
	return SOURCE_OPTIONS.find((option) => option.sourceKind === sourceKind) ?? SOURCE_OPTIONS[0]!;
}

export function supportsBackgroundTracking(_sourceKind: SourceKind): boolean {
	return true;
}

export function sourceDisplayName(sourceKind: SourceKind): string {
	return sourceOptionFor(sourceKind).label;
}

export function sourceCapabilityText(sourceKind: SourceKind): string {
	return `Extension tự theo dõi ${sourceOptionFor(sourceKind).origin} trong nền và phát hiện thay đổi.`;
}
