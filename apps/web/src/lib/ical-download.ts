import { formatIcalendar } from '../../../../packages/ical/src/index.ts';
import type { TimetableSnapshot } from '../../../../packages/timetable/src/index.ts';

const MIME_TYPE = 'text/calendar;charset=utf-8';

export interface IcalendarExport {
	content: string;
	filename: string;
	mimeType: typeof MIME_TYPE;
}

export interface DownloadAnchor {
	href: string;
	download: string;
	click(): void;
	remove(): void;
}

export interface IcalendarDownloadEnvironment {
	createUrl(blob: Blob): string;
	revokeUrl(url: string): void;
	createAnchor(): DownloadAnchor;
	appendAnchor(anchor: DownloadAnchor): void;
	scheduleCleanup(cleanup: () => void): void;
}

export interface IcalendarExportEnvironment {
	createFile?:
		((content: string, filename: string, mimeType: typeof MIME_TYPE) => File) | undefined;
	canShare?: ((data: ShareData) => boolean) | undefined;
	share?: ((data: ShareData) => Promise<void>) | undefined;
	downloadEnvironment: IcalendarDownloadEnvironment;
}

export function createIcalendarExport(
	snapshot: TimetableSnapshot,
	calendarName: string,
	options: { generatedAt?: Date } = {}
): IcalendarExport {
	return {
		content: formatIcalendar(snapshot, {
			calendarName,
			generatedAt: options.generatedAt ?? new Date()
		}),
		filename: `${sanitizeFilename(calendarName)}.ics`,
		mimeType: MIME_TYPE
	};
}

export async function exportIcalendarFile(
	file: IcalendarExport,
	environment: IcalendarExportEnvironment = createBrowserExportEnvironment()
): Promise<'shared' | 'downloaded'> {
	if (environment.createFile && environment.canShare && environment.share) {
		const sharedFile = environment.createFile(file.content, file.filename, file.mimeType);
		const shareData = { files: [sharedFile] };
		if (environment.canShare(shareData)) {
			await environment.share(shareData);
			return 'shared';
		}
	}

	downloadIcalendarFile(file, environment.downloadEnvironment);
	return 'downloaded';
}

export function triggerIcalendarDownload(file: IcalendarExport): Promise<'shared' | 'downloaded'> {
	return exportIcalendarFile(file);
}

function downloadIcalendarFile(
	file: IcalendarExport,
	environment: IcalendarDownloadEnvironment
): void {
	const url = environment.createUrl(new Blob([file.content], { type: file.mimeType }));
	const anchor = environment.createAnchor();
	anchor.href = url;
	anchor.download = file.filename;
	environment.appendAnchor(anchor);
	anchor.click();
	environment.scheduleCleanup(() => {
		anchor.remove();
		environment.revokeUrl(url);
	});
}

function sanitizeFilename(value: string): string {
	const safe = value
		.normalize('NFKC')
		.replace(/[•/\\?%*:|"<>]/gu, ' ')
		.replace(/[^\p{L}\p{N}._-]+/gu, '-')
		.replace(/-+/gu, '-')
		.replace(/^[.-]+|[.-]+$/gu, '');
	return safe || 'bkalendar';
}

function createBrowserExportEnvironment(): IcalendarExportEnvironment {
	const browserNavigator = typeof navigator === 'undefined' ? undefined : navigator;
	return {
		createFile:
			typeof File === 'undefined'
				? undefined
				: (content, filename, mimeType) => new File([content], filename, { type: mimeType }),
		canShare:
			typeof browserNavigator?.canShare === 'function'
				? (data) => browserNavigator.canShare(data)
				: undefined,
		share:
			typeof browserNavigator?.share === 'function'
				? (data) => browserNavigator.share(data)
				: undefined,
		downloadEnvironment: createBrowserDownloadEnvironment()
	};
}

function createBrowserDownloadEnvironment(): IcalendarDownloadEnvironment {
	return {
		createUrl: (blob) => URL.createObjectURL(blob),
		revokeUrl: (url) => URL.revokeObjectURL(url),
		createAnchor: () => document.createElement('a'),
		appendAnchor: (anchor) => document.body.append(anchor as HTMLAnchorElement),
		scheduleCleanup: (cleanup) => {
			window.setTimeout(cleanup, 1_000);
		}
	};
}
