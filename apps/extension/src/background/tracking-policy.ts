export type TrackingMode = 'off' | 'review' | 'auto-safe';

export interface ChangeSummary {
	added: number;
	changed: number;
	removed: number;
	unchanged: number;
	canDelete: boolean;
}

export interface TrackingAction {
	shouldTrack: boolean;
	shouldApplyUpserts: boolean;
	shouldApplyRemovals: boolean;
	shouldNotify: boolean;
	requiresRemovalConfirmation: boolean;
}

export function decideTrackingAction(mode: TrackingMode, changes: ChangeSummary): TrackingAction {
	if (mode === 'off') {
		return {
			shouldTrack: false,
			shouldApplyUpserts: false,
			shouldApplyRemovals: false,
			shouldNotify: false,
			requiresRemovalConfirmation: false
		};
	}
	const hasUpserts = changes.added + changes.changed > 0;
	const hasRemovals = changes.removed > 0;
	return {
		shouldTrack: true,
		shouldApplyUpserts: mode === 'auto-safe' && hasUpserts,
		shouldApplyRemovals: mode === 'auto-safe' && hasRemovals && changes.canDelete,
		shouldNotify: hasUpserts || hasRemovals,
		requiresRemovalConfirmation: mode === 'review' && hasRemovals
	};
}

export function isTrackingMode(value: unknown): value is TrackingMode {
	return value === 'off' || value === 'review' || value === 'auto-safe';
}

export function requiresGoogleConnection(mode: TrackingMode): boolean {
	return mode === 'auto-safe';
}

export function shouldRunAutomaticSync(mode: TrackingMode): boolean {
	return mode === 'auto-safe';
}
