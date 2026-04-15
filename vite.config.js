import { defineConfig } from 'vite';
import { resolve } from 'path';
import { glob } from 'glob';

export default defineConfig({
	root: 'src',
	publicDir: 'public',
	build: {
		rollupOptions: {
			input: Object.fromEntries(
				glob.sync('src/**/*.html', { ignore: ['node_modules/**', 'dist/**'] }).map(file => [
					file.replace(/\.html$/, ''),
					resolve(__dirname, file)
				])
			)
		},
		outDir: '../www',
		emptyOutDir: true
	}
});