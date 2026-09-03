import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createExtensionTransferRequest,
	createExtensionTransferEmptyResponse,
	createExtensionTransferResponse,
	createSnapshot,
	isExtensionTransferRequest,
	isExtensionTransferResponse
} from '../src/index.ts';

describe('extension-to-web transfer protocol', () => {
	it('round-trips a versioned nonce without putting timetable data in the request', () => {
		const request = createExtensionTransferRequest('request-123');

		assert.deepEqual(request, {
			source: 'bkalendar-web',
			type: 'bkalendar:request-pending-snapshot',
			version: 1,
			requestId: 'request-123'
		});
		assert.equal(isExtensionTransferRequest(request), true);
		assert.equal('snapshot' in request, false);
	});

	it('accepts only a matching versioned snapshot response', async () => {
		const snapshot = await createSnapshot({
			sourceKind: 'student-2024',
			semester: 261,
			capturedAt: '2026-09-03T00:00:00.000Z',
			warnings: [],
			events: []
		});
		const response = createExtensionTransferResponse('request-123', snapshot);

		assert.equal(isExtensionTransferResponse(response), true);
		assert.equal(response.requestId, 'request-123');
		assert.equal(response.snapshot.fingerprint, snapshot.fingerprint);
		assert.equal(isExtensionTransferResponse({ ...response, version: 2 }), false);
		assert.equal(isExtensionTransferResponse({ ...response, snapshot: { semester: 261 } }), false);
	});

	it('represents an installed extension with no pending timetable explicitly', () => {
		const response = createExtensionTransferEmptyResponse('request-123');

		assert.deepEqual(response, {
			source: 'bkalendar-extension',
			type: 'bkalendar:pending-snapshot',
			version: 1,
			requestId: 'request-123',
			status: 'empty'
		});
		assert.equal(isExtensionTransferResponse(response), true);
	});

	it('rejects malformed or empty request identifiers', () => {
		assert.throws(() => createExtensionTransferRequest('  '), /request ID/i);
		assert.equal(
			isExtensionTransferRequest({
				source: 'bkalendar-web',
				type: 'bkalendar:request-pending-snapshot',
				version: 1,
				requestId: ''
			}),
			false
		);
	});
});
