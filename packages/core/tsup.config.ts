import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/host.ts'],
  format: ['esm', 'cjs'],
  clean: true
});
