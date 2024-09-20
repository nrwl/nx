import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, writeJson } from '@nx/devkit';

import update from './update-typescript-eslint';

describe('update-typescript-eslint migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    writeJson(tree, 'tools/eslint-rules/tsconfig.json', {
      compilerOptions: {
        module: 'commonjs',
      },
    });
    writeJson(tree, 'tools/eslint-rules/tsconfig.spec.json', {
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: '../../dist/out-tsc',
        module: 'commonjs',
        types: ['jest', 'node'],
      },
      include: [
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*_spec.ts',
        '**/*_test.ts',
        '**/*.spec.tsx',
        '**/*.test.tsx',
        '**/*.spec.js',
        '**/*.test.js',
        '**/*.spec.jsx',
        '**/*.test.jsx',
        '**/*.d.ts',
        'jest.config.ts',
      ],
    });

    tree.write(
      'tools/eslint-rules/jest.config.ts',
      `/* eslint-disable */
export default {
  displayName: 'eslint-rules',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/tools/eslint-rules',
  moduleNameMapper: {
    '@eslint/eslintrc': '@eslint/eslintrc/dist/eslintrc-universal.cjs',
  },
};
`
    );

    tree.write(
      'tools/eslint-rules/rules/rule.ts',
      `/**
 * This file sets you up with structure needed for an ESLint rule.
 *
 * It leverages utilities from @typescript-eslint to allow TypeScript to
 * provide autocompletions etc for the configuration.
 *
 * Your rule's custom logic will live within the create() method below
 * and you can learn more about writing ESLint rules on the official guide:
 *
 * https://eslint.org/docs/developer-guide/working-with-rules
 *
 * You can also view many examples of existing rules here:
 *
 * https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/eslint-plugin/src/rules
 */

import { ESLintUtils } from '@typescript-eslint/utils';

// NOTE: The rule will be available in ESLint configs as "@nx/workspace-lint-rule"
export const RULE_NAME = 'lint-rule';

export const rule = ESLintUtils.RuleCreator(() => __filename)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: \`\`,
    },
    schema: [],
    messages: {},
  },
  defaultOptions: [],
  create(context) {
    return {};
  },
});
`
    );
  });

  it('should update the tsconfig.json', async () => {
    await update(tree);

    expect(
      tree.read('tools/eslint-rules/tsconfig.json', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('tools/eslint-rules/tsconfig.spec.json', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should update the jest.config.ts', async () => {
    await update(tree);

    expect(
      tree.read('tools/eslint-rules/jest.config.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should update the rules', async () => {
    await update(tree);

    expect(
      tree.read('tools/eslint-rules/rules/rule.ts', 'utf-8')
    ).toMatchSnapshot();
  });
});
