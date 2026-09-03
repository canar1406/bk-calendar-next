import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { unzipSync } from 'fflate';
import { createExtensionArchive } from '../package-extension.mjs';

describe('extension packaging', () => {
	it('creates a deterministic ZIP containing the built MV3 files', async () => {
		const root = await mkdtemp(join(tmpdir(), 'bkalendar-extension-'));
		const input = join(root, 'dist');
		const output = join(root, 'artifacts', 'bkalendar-next-extension.zip');
		await import('node:fs/promises').then(({ mkdir }) => mkdir(input, { recursive: true }));
		await writeFile(
			join(input, 'manifest.json'),
			JSON.stringify({ manifest_version: 3, name: 'BKalendar Next', version: '0.1.0' })
		);
		await writeFile(join(input, 'background.js'), 'console.log("background");');

		await createExtensionArchive(input, output);
		const archive = unzipSync(new Uint8Array(await readFile(output)));

		assert.deepEqual(Object.keys(archive).sort(), ['background.js', 'manifest.json']);
		assert.match(new TextDecoder().decode(archive['manifest.json']), /"manifest_version":3/);
	});
});
