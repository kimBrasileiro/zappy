import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { widget: 'src/index.ts' },
  format: ['iife'],
  target: 'es2020',
  minify: true,
  sourcemap: false,
  clean: true,
  // Plain <script> load, no host page module system assumed.
  platform: 'browser',
  // tsup defaults IIFE output to `widget.global.js` — force plain `.js` so
  // the on-disk artifact matches the documented CDN path (dist/widget.js).
  outExtension: () => ({ js: '.js' }),
});
