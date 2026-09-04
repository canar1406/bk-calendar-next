import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const extensionRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	build: {
		emptyOutDir: false,
		outDir: resolve(extensionRoot, 'dist'),
		rollupOptions: {
			input: resolve(extensionRoot, 'src/content/index.ts'),
			output: {
				format: 'iife',
				entryFileNames: 'content.js',
				inlineDynamicImports: true
			}
		}
	}
});
