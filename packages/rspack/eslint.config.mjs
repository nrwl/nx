import { baseConfig } from '../../eslint.config.mjs';
import * as jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  { ignores: ['dist'] },
  {
    files: ['./package.json', './generators.json', './executors.json'],
    rules: {
      '@nx/nx-plugin-checks': 'error',
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
  {
    files: ['./package.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          buildTargets: ['build-base'],
          ignoredDependencies: [
            'nx',
            'typescript',
            'postcss-loader',
            '@rspack/cli',
            // Resolved from @rspack/cli 1.0 to 1.5, which parse with it
            'yargs',
            '@nx/workspace',
            '@nx/react',
            '@nx/nest',
            '@nx/web',
            'css-loader',
            'webpack',
            'sass-embedded',
            'sass',
            'ts-checker-rspack-plugin',
            'less-loader',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
