import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createManagedCalendar, GoogleCalendarRestGateway } from '../src/rest.ts';

describe('Google Calendar quota handling', () => {
	it('retries temporary API quota limits without opening another login popup', async () => {
		let calls = 0;
		const gateway = new GoogleCalendarRestGateway('synthetic-token', async () => {
			calls++;
			return calls < 2
				? new Response(
						JSON.stringify({ error: { errors: [{ reason: 'userRateLimitExceeded' }] } }),
						{ status: 403, headers: { 'Retry-After': '0' } }
					)
				: Response.json({ items: [] });
		});
		assert.deepEqual(await gateway.listManagedEvents('test-calendar'), []);
		assert.equal(calls, 2);
	});

	it('does not retry permission failures as if they were temporary quota errors', async () => {
		let calls = 0;
		const gateway = new GoogleCalendarRestGateway('synthetic-token', async () => {
			calls++;
			return Response.json({ error: { message: 'insufficientPermissions' } }, { status: 403 });
		});
		await assert.rejects(gateway.listManagedEvents('test-calendar'), /403/u);
		assert.equal(calls, 1);
	});

	it('bounds retries when Google continues to return 429', async () => {
		let calls = 0;
		const gateway = new GoogleCalendarRestGateway('synthetic-token', async () => {
			calls++;
			return new Response('rateLimitExceeded', {
				status: 429,
				headers: { 'Retry-After': '0' }
			});
		});
		await assert.rejects(gateway.listManagedEvents('test-calendar'), /chờ vài phút/iu);
		assert.equal(calls, 3);
	});

	it('does not replay calendar creation after an ambiguous server failure', async () => {
		let calls = 0;
		await assert.rejects(
			createManagedCalendar(
				async () => {
					calls++;
					return new Response('temporary error', { status: 503 });
				},
				'synthetic-token',
				'Exam calendar'
			),
			/503/u
		);
		assert.equal(calls, 1);
	});
});
