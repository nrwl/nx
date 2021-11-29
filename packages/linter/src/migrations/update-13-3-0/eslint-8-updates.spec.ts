import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import eslint8Updates from './eslint-8-updates';

describe('eslint8Updates()', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(
      `tools/eslint-rules/jest.config.js`,
      `
        module.exports = {
          displayName: 'eslint-rules',
          preset: '../../jest.preset.js',
          globals: {
            'ts-jest': {
              tsconfig: '<rootDir>/tsconfig.spec.json',
            },
          },
          transform: {
            '^.+\\.[tj]s$': 'ts-jest',
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../../coverage/tools/eslint-rules',
        };
      `
    );

    tree.write(
      `tools/eslint-rules/rules/existing-rule.ts`,
      `
        import { ESLintUtils } from '@typescript-eslint/experimental-utils';
        
        // NOTE: The rule will be available in ESLint configs as "@nrwl/nx/workspace/existing-rule"
        export const RULE_NAME = 'existing-rule';
        
        export const rule = ESLintUtils.RuleCreator(() => __filename)({
          name: RULE_NAME,
          meta: {
            type: 'problem',
            docs: {
              description: \`\`,
              category: 'Possible Errors',
              recommended: 'error',
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

  it('should add module mapping for ESLint to the jest config', async () => {
    await eslint8Updates(tree);

    expect(tree.read('tools/eslint-rules/jest.config.js').toString('utf-8'))
      .toMatchInlineSnapshot(`
      "
              module.exports = {
                displayName: 'eslint-rules',
                preset: '../../jest.preset.js',
                globals: {
                  'ts-jest': {
                    tsconfig: '<rootDir>/tsconfig.spec.json',
                  },
                },
                transform: {
                  '^.+\\\\.[tj]s$': 'ts-jest',
                },
                moduleFileExtensions: ['ts', 'js', 'html'],
                coverageDirectory: '../../coverage/tools/eslint-rules',\\"moduleNameMapper\\": {\\"@eslint/eslintrc\\":\\"@eslint/eslintrc/dist/eslintrc-universal.cjs\\"}
              };
            "
    `);
  });

  it('should remove the category meta property from any existing workspace rules', async () => {
    await eslint8Updates(tree);

    expect(
      tree.read(`tools/eslint-rules/rules/existing-rule.ts`).toString('utf-8')
    ).toMatchInlineSnapshot(`
      "
              import { ESLintUtils } from '@typescript-eslint/experimental-utils';
              
              // NOTE: The rule will be available in ESLint configs as \\"@nrwl/nx/workspace/existing-rule\\"
              export const RULE_NAME = 'existing-rule';
              
              export const rule = ESLintUtils.RuleCreator(() => __filename)({
                name: RULE_NAME,
                meta: {
                  type: 'problem',
                  docs: {
                    description: \`\`,
                    recommended: 'error',
                  },
                  schema: [],
                  messages: {},
                },
                defaultOptions: [],
                create(context) {
                  return {};
                },
              });
            "
    `);
  });
});
