import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const extensionRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	build: {
		emptyOutDir: false,
		outDir: resolve(extensionRoot, 'dist'),
		rollupOptions: {
			input: resolve(extensionRoot, 'src/bridge/web-review.ts'),
			output: {
				format: 'iife',
				entryFileNames: 'web-review.js',
				inlineDynamicImports: true
			}
		}
	}
});
