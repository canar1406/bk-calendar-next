import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createFetchMyBkHttpClient,
	fetchMyBkTimetable,
	type MyBkHttpClient,
	type MyBkHttpResponse
} from '../src/background/mybk-client.ts';

const timetableHtml = `
<html><body>
<p>Ngày cập nhật gần nhất của HK này: 03/09/2026 15:03:21</p>
<table>
  <thead><tr><th>HỌC KỲ</th><th>MÃ MH</th><th>TÊN MÔN HỌC</th><th>TÍN CHỈ</th><th>TC HỌC PHÍ</th><th>NHÓM - TỔ</th><th>THỨ</th><th>TIẾT</th><th>GIỜ HỌC</th><th>PHÒNG</th><th>CƠ SỞ</th><th>TUẦN HỌC</th></tr></thead>
  <tbody><tr><td>20261</td><td>AS1002</td><td>Nhập môn Kỹ thuật</td><td>0</td><td>0</td><td>L02</td><td>5</td><td>2 - 3</td><td>7:00 - 8:50</td><td>H3-502</td><td>BK-CS2</td><td>--|36|37|</td></tr></tbody>
</table>
<p>Trình bày từ dòng 1 đến 1 / 1 dòng</p>
</body></html>`;

const myBkLoginHtml = `
<html><body>
  <a href="/app/login?type=cas">Tài khoản HCMUT</a>
</body></html>`;

const casLoginHtml = `
<form id="fm1" action="/cas/login;jsessionid=abc?service=https%3A%2F%2Fmybk.hcmut.edu.vn%2Fapp%2Flogin%2Fcas" method="post">
  <input id="username" name="username" type="text" />
  <input id="password" name="password" type="password" />
  <input type="hidden" name="lt" value="LT-123" />
  <input type="hidden" name="execution" value="e1s1" />
  <input type="hidden" name="_eventId" value="submit" />
  <input name="submit" value="Login" type="submit" />
</form>`;

class ScriptedClient implements MyBkHttpClient {
	readonly requests: Array<{ url: string; init?: RequestInit }> = [];
	private readonly responses: MyBkHttpResponse[];

	constructor(responses: MyBkHttpResponse[]) {
		this.responses = responses;
	}

	async request(url: string, init?: RequestInit): Promise<MyBkHttpResponse> {
		this.requests.push(init === undefined ? { url } : { url, init });
		const response = this.responses.shift();
		if (!response) throw new Error(`Unexpected request: ${url}`);
		return response;
	}
}

class InitialFailureClient extends ScriptedClient {
	private firstRequest = true;

	override async request(url: string, init?: RequestInit): Promise<MyBkHttpResponse> {
		if (this.firstRequest) {
			this.firstRequest = false;
			this.requests.push(init === undefined ? { url } : { url, init });
			throw new Error('insecure redirect blocked');
		}
		return await super.request(url, init);
	}
}

describe('background MyBK CAS client', () => {
	it('reports a background network failure without exposing the raw fetch error', async () => {
		const client = createFetchMyBkHttpClient(async () => {
			throw new TypeError('Failed to fetch');
		});

		await assert.rejects(
			() => client.request('https://mybk.hcmut.edu.vn/app/login?type=cas'),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				assert.match(error.message, /không thể kết nối mybk trong nền/i);
				assert.equal(error.message.includes('Failed to fetch'), false);
				return true;
			}
		);
	});

	it('reuses an authenticated MyBK session without sending the password', async () => {
		const client = new ScriptedClient([
			{
				url: 'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb',
				status: 200,
				body: timetableHtml
			}
		]);

		const capture = await fetchMyBkTimetable(client, {
			username: 'student',
			password: 'secret'
		});

		assert.equal(capture.completeness.state, 'complete');
		assert.match(capture.raw, /AS1002/);
		assert.equal(client.requests.length, 1);
		assert.equal(client.requests[0]?.init?.method, 'GET');
	});

	it('logs into HCMUT CAS in the background and then reads the timetable', async () => {
		const client = new ScriptedClient([
			{
				url: 'https://mybk.hcmut.edu.vn/app/login',
				status: 200,
				body: myBkLoginHtml
			},
			{
				url: 'https://sso.hcmut.edu.vn/cas/login?service=mybk',
				status: 200,
				body: casLoginHtml
			},
			{
				url: 'https://mybk.hcmut.edu.vn/app/',
				status: 200,
				body: '<html>Đăng nhập thành công</html>'
			},
			{
				url: 'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb',
				status: 200,
				body: timetableHtml
			}
		]);

		const capture = await fetchMyBkTimetable(client, {
			username: 'student@hcmut.edu.vn',
			password: 'p@ss word'
		});

		assert.match(capture.raw, /20261/);
		assert.deepEqual(
			client.requests.map((request) => request.url),
			[
				'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb',
				'https://mybk.hcmut.edu.vn/app/login?type=cas',
				'https://sso.hcmut.edu.vn/cas/login;jsessionid=abc?service=https%3A%2F%2Fmybk.hcmut.edu.vn%2Fapp%2Flogin%2Fcas',
				'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb'
			]
		);
		const formBody = String(client.requests[2]?.init?.body);
		assert.equal(client.requests[2]?.init?.method, 'POST');
		assert.match(formBody, /username=student%40hcmut.edu.vn/);
		assert.match(formBody, /password=p%40ss\+word/);
		assert.match(formBody, /lt=LT-123/);
		assert.match(formBody, /execution=e1s1/);
	});

	it('falls back to the direct HTTPS CAS entry when MyBK emits an insecure login redirect', async () => {
		const client = new InitialFailureClient([
			{
				url: 'https://sso.hcmut.edu.vn/cas/login?service=mybk',
				status: 200,
				body: casLoginHtml
			},
			{
				url: 'https://mybk.hcmut.edu.vn/app/',
				status: 200,
				body: '<html>Đăng nhập thành công</html>'
			},
			{
				url: 'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb',
				status: 200,
				body: timetableHtml
			}
		]);

		const capture = await fetchMyBkTimetable(client, {
			username: 'student',
			password: 'secret'
		});

		assert.match(capture.raw, /AS1002/);
		assert.equal(client.requests[1]?.url, 'https://mybk.hcmut.edu.vn/app/login?type=cas');
	});

	it('reports invalid credentials without including the password in the error', async () => {
		const client = new ScriptedClient([
			{
				url: 'https://mybk.hcmut.edu.vn/app/login',
				status: 200,
				body: myBkLoginHtml
			},
			{
				url: 'https://sso.hcmut.edu.vn/cas/login?service=mybk',
				status: 200,
				body: casLoginHtml
			},
			{
				url: 'https://sso.hcmut.edu.vn/cas/login',
				status: 200,
				body: `${casLoginHtml}<div class="errors">Invalid credentials</div>`
			}
		]);

		await assert.rejects(
			() =>
				fetchMyBkTimetable(client, {
					username: 'student',
					password: 'never-leak-this'
				}),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				assert.match(error.message, /Tài khoản hoặc mật khẩu MyBK không đúng/);
				assert.equal(error.message.includes('never-leak-this'), false);
				return true;
			}
		);
	});
});
