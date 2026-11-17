import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/node_modules/', '**/dist/', '**/coverage/', '**/src/generated/', 'docs/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  // Scripts sueltos de Node (los de `tools/`). En los `.ts` esta regla la apaga
  // typescript-eslint, que ya tiene los tipos; aquí hay que nombrar los globales a mano.
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
  },
  prettier,
]);
