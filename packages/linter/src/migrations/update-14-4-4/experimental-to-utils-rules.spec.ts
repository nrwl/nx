import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import experimentalToUtilsUpdate from './experimental-to-utils-rules';

describe('experimentalToUtilsUpdate()', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write(
      `tools/eslint-rules/rules/existing-rule.ts`,
      `
        import { ESLintUtils } from '@typescript-eslint/experimental-utils';
        import { rule, RULE_NAME } from './existing-rule';

        // NOTE: The rule will be available in ESLint configs as "@nrwl/nx/workspace/existing-rule"
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
      `
    );

    tree.write(
      `tools/eslint-rules/rules/existing-rule.spec.ts`,
      `
      import { TSESLint } from '@typescript-eslint/experimental-utils';
      import { rule, RULE_NAME } from './existing-rule';

      const ruleTester = new TSESLint.RuleTester({
        parser: require.resolve('@typescript-eslint/parser'),
      });

      ruleTester.run(RULE_NAME, rule, {
        valid: [\`const example = true;\`],
        invalid: [],
      });
      `
    );

    tree.write(
      `tools/eslint-rules/rules/multi-import.ts`,
      `
        import { ESLintUtils } from '@typescript-eslint/experimental-utils';
        import { TSESLint } from '@typescript-eslint/experimental-utils';
        import { rule, RULE_NAME } from './existing-rule';

        // NOTE: remaining code is irrelevant for this test
      `
    );
  });

  it('should switch import from @typescript-eslint/experimental-utils to @typescript-eslint/utils in rule and spec file', async () => {
    await experimentalToUtilsUpdate(tree);

    expect(
      tree.read(`tools/eslint-rules/rules/existing-rule.ts`).toString('utf-8')
    ).toMatchInlineSnapshot(`
      "import { ESLintUtils } from '@typescript-eslint/utils';
      import { rule, RULE_NAME } from './existing-rule';

      // NOTE: The rule will be available in ESLint configs as "@nrwl/nx/workspace/existing-rule"
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

    expect(
      tree
        .read(`tools/eslint-rules/rules/existing-rule.spec.ts`)
        .toString('utf-8')
    ).toMatchInlineSnapshot(`
      "import { TSESLint } from '@typescript-eslint/utils';
      import { rule, RULE_NAME } from './existing-rule';

      const ruleTester = new TSESLint.RuleTester({
        parser: require.resolve('@typescript-eslint/parser'),
      });

      ruleTester.run(RULE_NAME, rule, {
        valid: [\`const example = true;\`],
        invalid: [],
      });
      "
    `);
  });

  it('should switch import from @typescript-eslint/experimental-utils to @typescript-eslint/utils on multiple imports', async () => {
    await experimentalToUtilsUpdate(tree);

    expect(
      tree.read(`tools/eslint-rules/rules/multi-import.ts`).toString('utf-8')
    ).toMatchInlineSnapshot(`
      "import { ESLintUtils } from '@typescript-eslint/utils';
      import { TSESLint } from '@typescript-eslint/utils';
      import { rule, RULE_NAME } from './existing-rule';

      // NOTE: remaining code is irrelevant for this test
      "
    `);
  });
});
