import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	decideTrackingAction,
	requiresGoogleConnection,
	type TrackingMode
} from '../src/background/tracking-policy.ts';

const changes = {
	added: 2,
	changed: 1,
	removed: 1,
	unchanged: 5,
	canDelete: true
};

describe('background timetable tracking policy', () => {
	it('does not fetch MyBK when tracking is disabled', () => {
		assert.deepEqual(decideTrackingAction('off', changes), {
			shouldTrack: false,
			shouldApplyUpserts: false,
			shouldApplyRemovals: false,
			shouldNotify: false,
			requiresRemovalConfirmation: false
		});
	});

	it('requires Google Calendar before enabling automatic updates', () => {
		assert.equal(requiresGoogleConnection('auto-safe'), true);
		assert.equal(requiresGoogleConnection('review'), false);
		assert.equal(requiresGoogleConnection('off'), false);
	});

	it('stages and reports the full diff in review mode without writing Google', () => {
		assert.deepEqual(decideTrackingAction('review', changes), {
			shouldTrack: true,
			shouldApplyUpserts: false,
			shouldApplyRemovals: false,
			shouldNotify: true,
			requiresRemovalConfirmation: true
		});
	});

	it('automatically applies a complete diff and only notifies after the update', () => {
		assert.deepEqual(decideTrackingAction('auto-safe', changes), {
			shouldTrack: true,
			shouldApplyUpserts: true,
			shouldApplyRemovals: true,
			shouldNotify: true,
			requiresRemovalConfirmation: false
		});
	});

	it('sends a passive post-update notification after an automatic insert or patch', () => {
		assert.deepEqual(
			decideTrackingAction('auto-safe', {
				added: 1,
				changed: 2,
				removed: 0,
				unchanged: 5,
				canDelete: true
			}),
			{
				shouldTrack: true,
				shouldApplyUpserts: true,
				shouldApplyRemovals: false,
				shouldNotify: true,
				requiresRemovalConfirmation: false
			}
		);
	});

	it('stays quiet when an automatic check finds no changes', () => {
		const mode: TrackingMode = 'auto-safe';
		assert.deepEqual(
			decideTrackingAction(mode, {
				added: 0,
				changed: 0,
				removed: 0,
				unchanged: 8,
				canDelete: true
			}),
			{
				shouldTrack: true,
				shouldApplyUpserts: false,
				shouldApplyRemovals: false,
				shouldNotify: false,
				requiresRemovalConfirmation: false
			}
		);
	});

	it('blocks automatic removal when the MyBK capture is incomplete', () => {
		assert.deepEqual(
			decideTrackingAction('auto-safe', {
				...changes,
				canDelete: false
			}),
			{
				shouldTrack: true,
				shouldApplyUpserts: true,
				shouldApplyRemovals: false,
				shouldNotify: true,
				requiresRemovalConfirmation: false
			}
		);
	});
});
