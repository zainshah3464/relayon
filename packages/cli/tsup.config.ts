import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});