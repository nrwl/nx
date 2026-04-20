import { baseConfig } from '../../eslint.config.mjs';
import nx from '@nx/eslint-plugin';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  {
    rules: {
      '@typescript-eslint/no-implicit-any': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['rxjs'],
          patterns: ['rxjs/*'],
        },
      ],
    },
  },
  {
    ignores: ['src/assets/generated-*'],
  },
];
