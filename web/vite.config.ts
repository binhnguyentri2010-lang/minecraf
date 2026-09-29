import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The shipped bundle runs on Preact (same API, ~10x smaller than React DOM => faster start on iPad).
// Development and type-checking keep the real React so hot reload and typings stay simple.
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [react()],
  resolve:
    command === 'build' && !process.env.REACT_BUNDLE
      ? {
          alias: {
            react: 'preact/compat',
            'react-dom/client': 'preact/compat/client',
            'react-dom': 'preact/compat',
            'react/jsx-runtime': 'preact/jsx-runtime',
          },
        }
      : {},
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
