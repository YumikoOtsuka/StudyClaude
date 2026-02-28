import globals from 'globals';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script', // バニラJS・CDN読み込みのためモジュールなし
      globals: {
        ...globals.browser,
        Chart: 'readonly', // Chart.js (CDN)
      },
    },
    rules: {
      // エラー
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],

      // 警告
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
      'curly': 'warn',

      // 無効化（開発中の console.log を許容）
      'no-console': 'off',
    },
  },
];
