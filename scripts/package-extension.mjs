import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zipSync } from 'fflate';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_INPUT = resolve(REPOSITORY_ROOT, 'apps/extension/dist');
const DEFAULT_OUTPUT = resolve(
	REPOSITORY_ROOT,
	'artifacts/bkalendar-next-extension-chrome-edge.zip'
);
const ZIP_TIMESTAMP = new Date('1980-01-01T00:00:00.000Z');

export async function createExtensionArchive(inputDirectory, outputFile) {
	const entries = await collectFiles(resolve(inputDirectory));
	if (!entries.has('manifest.json')) {
		throw new Error(`Extension build is missing manifest.json in ${inputDirectory}`);
	}

	const files = {};
	for (const [path, content] of entries) {
		files[path] = [content, { mtime: ZIP_TIMESTAMP }];
	}

	await mkdir(dirname(outputFile), { recursive: true });
	await writeFile(outputFile, zipSync(files, { level: 9 }));
	return outputFile;
}

async function collectFiles(root) {
	const entries = new Map();
	await visit(root);
	return entries;

	async function visit(directory) {
		const children = await readdir(directory, { withFileTypes: true });
		children.sort((left, right) => left.name.localeCompare(right.name));
		for (const child of children) {
			if (child.name === '.DS_Store') continue;
			const absolutePath = resolve(directory, child.name);
			if (child.isDirectory()) {
				await visit(absolutePath);
				continue;
			}
			if (!child.isFile()) continue;
			const archivePath = relative(root, absolutePath).split(sep).join('/');
			entries.set(archivePath, new Uint8Array(await readFile(absolutePath)));
		}
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const output = await createExtensionArchive(
		process.argv[2] ? resolve(process.argv[2]) : DEFAULT_INPUT,
		process.argv[3] ? resolve(process.argv[3]) : DEFAULT_OUTPUT
	);
	console.log(`Created ${relative(REPOSITORY_ROOT, output)}`);
}
