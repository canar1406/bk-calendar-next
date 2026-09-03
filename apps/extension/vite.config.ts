import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const extensionRoot = dirname(fileURLToPath(import.meta.url));

function emitManifest(): Plugin {
	return {
		name: 'emit-extension-manifest',
		apply: 'build',
		generateBundle() {
			this.emitFile({
				type: 'asset',
				fileName: 'manifest.json',
				source: readFileSync(resolve(extensionRoot, 'manifest.json'), 'utf8')
			});
		}
	};
}

export default defineConfig({
	plugins: [emitManifest()],
	build: {
		emptyOutDir: true,
		outDir: 'dist',
		rollupOptions: {
			input: {
				background: resolve(extensionRoot, 'src/background/index.ts'),
				content: resolve(extensionRoot, 'src/content/index.ts'),
				'web-review': resolve(extensionRoot, 'src/bridge/web-review.ts'),
				popup: resolve(extensionRoot, 'src/popup/index.html')
			},
			output: {
				entryFileNames: '[name].js',
				chunkFileNames: 'chunks/[name]-[hash].js',
				assetFileNames: 'assets/[name][extname]'
			}
		}
	}
});
