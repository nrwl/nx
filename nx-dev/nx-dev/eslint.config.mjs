import { baseConfig, reactHooksV7Off } from '../../eslint.config.mjs';
import nx from '@nx/eslint-plugin';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  ...reactHooksV7Off,
  {
    ignores: ['**/.next', 'public', 'lib/banner.json'],
  },
];
