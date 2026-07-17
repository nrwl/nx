import { baseConfig, reactHooksV7Off } from '../../eslint.config.mjs';
import nx from '@nx/eslint-plugin';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  ...reactHooksV7Off,
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
