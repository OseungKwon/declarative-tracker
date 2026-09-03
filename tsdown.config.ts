import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', dom: 'src/dom/index.ts', react: 'src/react/index.ts' },
  format: ['esm', 'cjs'],
  platform: 'browser',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
});
