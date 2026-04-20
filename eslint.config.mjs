import nx from '@nx/eslint-plugin';
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';
import typescriptEslintParser from '@typescript-eslint/parser';
import globals from 'globals';
import jest from 'eslint-plugin-jest';
import * as jsoncEslintParser from 'jsonc-eslint-parser';
import storybook from 'eslint-plugin-storybook';
import toolsEslintRulesRawFileParserJs from './tools/eslint-rules/raw-file-parser.js';

const testFiles = [
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.js',
  '**/*.spec.jsx',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.js',
  '**/*.test.jsx',
];

// eslint-plugin-storybook's flat/recommended references rules from react-hooks
// and import-x (not registered in this repo). Keep only storybook-owned rules
// to avoid "plugin not found" validation errors.
const storybookConfigs = storybook.configs['flat/recommended'].map((config) => {
  if (!config.rules) return config;
  const ownRules = Object.fromEntries(
    Object.entries(config.rules).filter(([name]) =>
      name.startsWith('storybook/')
    )
  );
  return { ...config, rules: ownRules };
});

// Shared base consumed by every subproject via the named export below.
// IMPORTANT: subprojects import `{ baseConfig }`, not the default, so they
// don't inherit the root's "ignore everything" safety net.
export const baseConfig = [
  { ignores: ['**/dist', '**/out-tsc', '**/test-output'] },
  ...storybookConfigs,
  ...nx.configs['flat/base'],
  { plugins: { '@typescript-eslint': typescriptEslintEslintPlugin } },
  {
    languageOptions: {
      parser: typescriptEslintParser,
      globals: { ...globals.node },
    },
  },
  {
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'create-nx-workspace',
              message: 'Please import utils from nx or @nx/devkit instead.',
            },
            {
              name: 'node-fetch',
              message:
                "Please default to native fetch instead of 'node-fetch'.",
            },
          ],
        },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['nx/src/plugins/js*'],
              message:
                "Imports from 'nx/src/plugins/js' are not allowed. Use '@nx/js' instead",
            },
            {
              group: ['**/native-bindings', '**/native-bindings.js', ''],
              message:
                'Direct imports from native-bindings.js are not allowed. Import from index.js instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['.storybook/**/main.@(js|cjs|mjs|ts)'],
    rules: {
      'storybook/no-uninstalled-addons': [
        'error',
        {
          ignore: ['@nx/react/plugins/storybook'],
          packageJsonLocation: '../../package.json',
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
  {
    files: ['**/executors/**/schema.json', '**/generators/**/schema.json'],
    rules: {
      '@nx/workspace-valid-schema-description': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          checkDynamicDependenciesExceptions: ['.*'],
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
      '@nx/workspace-valid-command-object': 'error',
      '@nx/workspace-require-windows-hide': 'error',
    },
  },
  {
    files: ['pnpm-lock.yaml'],
    rules: {
      '@nx/workspace-ensure-pnpm-lock-version': [
        'error',
        {
          version: '9.0',
        },
      ],
    },
    languageOptions: {
      parser: toolsEslintRulesRawFileParserJs,
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/prefer-standalone': 'off',
    },
  },
  {
    files: testFiles,
    plugins: { jest },
    rules: {
      'jest/no-disabled-tests': 'warn',
    },
  },
];

// eslint-plugin-react-hooks@7 introduced stricter rules (set-state-in-effect,
// purity, immutability, etc.) that flag pre-existing patterns across the
// nx-dev / graph React apps. These are pulled in by `nx.configs['flat/react']`
// so spreading them here in baseConfig would be overridden by leaves that
// spread flat/react later. Leaves that use flat/react should spread this after
// it. Drop this override once the violations are fixed in a follow-up PR.
export const reactHooksV7Off = [
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/config': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/gating': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/globals': 'off',
    },
  },
];

// e2e/* subprojects legacy-only linted test files (via ignorePatterns with
// `!**/*.test.ts` negation). Replicate the scope in flat config so each e2e
// leaf just spreads this.
export const e2eTestOnlyIgnores = {
  ignores: [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx',
    '!**/*.test.ts',
    '!**/*.test.tsx',
    '!**/*.spec.ts',
    '!**/*.spec.tsx',
  ],
};

// Default export: for workspace-root lint invocations only. Subprojects have
// their own eslint.config.mjs (nearest-ancestor resolution) and never see this.
// Ignore everything except root-scoped files that should be linted at workspace
// level (currently just pnpm-lock.yaml via the @nx/workspace-ensure-pnpm-lock
// rule); the root isn't meant to lint subprojects directly.
export default [...baseConfig, { ignores: ['**/*', '!pnpm-lock.yaml'] }];
