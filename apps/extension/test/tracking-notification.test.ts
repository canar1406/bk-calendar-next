import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	TRACKING_NOTIFICATION_ID,
	buildTrackingNotification,
	isTrackingNotification
} from '../src/background/tracking-notification.ts';

describe('post-update tracking notification', () => {
	it('reports an already-applied automatic diff without asking permission', () => {
		const notification = buildTrackingNotification('applied', {
			added: 2,
			changed: 1,
			removed: 1,
			unchanged: 4,
			canDelete: true
		});

		assert.equal(notification.title, 'BKalendar đã cập nhật thời khóa biểu');
		assert.match(notification.message, /2 thêm mới/);
		assert.match(notification.message, /1 thay đổi/);
		assert.match(notification.message, /1 đã xóa/);
		assert.equal(notification.message.includes('xác nhận'), false);
	});

	it('makes review mode explicit before anything is changed', () => {
		const notification = buildTrackingNotification('review', {
			added: 0,
			changed: 1,
			removed: 0,
			unchanged: 7,
			canDelete: true
		});

		assert.equal(notification.title, 'BKalendar phát hiện thay đổi');
		assert.match(notification.message, /chưa cập nhật Google Calendar/);
	});

	it('identifies only BKalendar tracking notifications for click-to-diff', () => {
		assert.equal(isTrackingNotification(TRACKING_NOTIFICATION_ID), true);
		assert.equal(isTrackingNotification(`${TRACKING_NOTIFICATION_ID}:261`), true);
		assert.equal(isTrackingNotification('another-extension'), false);
	});
});
