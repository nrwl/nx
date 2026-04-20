import { baseConfig } from '../../eslint.config.mjs';
import nx from '@nx/eslint-plugin';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  {
    ignores: ['**/.next', 'public', 'lib/banner.json'],
  },
];
