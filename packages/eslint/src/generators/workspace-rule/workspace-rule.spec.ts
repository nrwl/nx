import 'nx/src/internal-testing-utils/mock-project-graph';

import { readJson, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { lintWorkspaceRuleGenerator } from './workspace-rule';

describe('@nx/eslint:workspace-rule', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should generate the required files', async () => {
    await lintWorkspaceRuleGenerator(tree, {
      name: 'my-rule',
      directory: 'rules',
    });

    expect(
      tree.read('tools/eslint-rules/rules/my-rule.ts', 'utf-8')
    ).toMatchSnapshot();

    expect(
      tree.read('tools/eslint-rules/rules/my-rule.spec.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should update the plugin index.ts with the new rule', async () => {
    await lintWorkspaceRuleGenerator(tree, {
      name: 'my-rule',
      directory: 'rules',
    });

    // NOTE: formatFiles() will have been run so the real formatting will look better than this snapshot
    expect(tree.read('tools/eslint-rules/index.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should update the plugin index.ts with the new rule correctly, regardless of whether the existing rules config has a trailing comma', async () => {
    // ------------------------------------------- NO EXISTING RULE

    tree.write(
      'tools/eslint-rules/index.ts',
      `
      module.exports = {
        rules: {}
      };
    `
    );

    await lintWorkspaceRuleGenerator(tree, {
      name: 'my-rule',
      directory: 'rules',
    });

    // NOTE: formatFiles() will have been run so the real formatting will look better than this snapshot
    expect(tree.read('tools/eslint-rules/index.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { RULE_NAME as myRuleName, rule as myRule } from './rules/my-rule';
      /**
       * Import your custom workspace rules at the top of this file.
       *
       * For example:
       *
       * import { RULE_NAME as myCustomRuleName, rule as myCustomRule } from './rules/my-custom-rule';
       *
       * In order to quickly get started with writing rules you can use the
       * following generator command and provide your desired rule name:
       *
       * \`\`\`sh
       * npx nx g @nx/eslint:workspace-rule {{ NEW_RULE_NAME }}
       * \`\`\`
       */

      module.exports = {
        /**
         * Apply the imported custom rules here.
         *
         * For example (using the example import above):
         *
         * rules: {
         *  [myCustomRuleName]: myCustomRule
         * }
         */
        rules: { [myRuleName]: myRule },
      };
      "
    `);

    // ------------------------------------------- EXISTING RULE, NO TRAILING COMMA

    tree.write(
      'tools/eslint-rules/index.ts',
      `
      module.exports = {
        rules: {
          'existing-rule-no-comma': 'error'
        }
      };
    `
    );

    await lintWorkspaceRuleGenerator(tree, {
      name: 'my-rule',
      directory: 'rules',
    });

    // NOTE: formatFiles() will have been run so the real formatting will look better than this snapshot
    expect(tree.read('tools/eslint-rules/index.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { RULE_NAME as myRuleName, rule as myRule } from './rules/my-rule';

      module.exports = {
        rules: {
          'existing-rule-no-comma': 'error',
          [myRuleName]: myRule,
        },
      };
      "
    `);

    // ------------------------------------------- EXISTING RULE, WITH TRAILING COMMA

    tree.write(
      'tools/eslint-rules/index.ts',
      `
      module.exports = {
        rules: {
          'existing-rule-with-comma': 'error',
        }
      };
    `
    );

    await lintWorkspaceRuleGenerator(tree, {
      name: 'my-rule',
      directory: 'rules',
    });

    // NOTE: formatFiles() will have been run so the real formatting will look better than this snapshot
    expect(tree.read('tools/eslint-rules/index.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { RULE_NAME as myRuleName, rule as myRule } from './rules/my-rule';

      module.exports = {
        rules: {
          'existing-rule-with-comma': 'error',
          [myRuleName]: myRule,
        },
      };
      "
    `);
  });

  describe('ESLint v9 + eslintrc workspaces', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'false';
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          ...json.devDependencies,
          eslint: '^9.8.0',
        };
        return json;
      });
    });

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.ESLINT_USE_FLAT_CONFIG;
      } else {
        process.env.ESLINT_USE_FLAT_CONFIG = originalEnv;
      }
    });

    it('should generate the eslintrc rule-test template using flat-style RuleTester args and not install @typescript-eslint/rule-tester', async () => {
      await lintWorkspaceRuleGenerator(tree, {
        name: 'my-rule',
        directory: 'rules',
      });

      const spec = tree.read(
        'tools/eslint-rules/rules/my-rule.spec.ts',
        'utf-8'
      );
      expect(spec).toContain("from '@typescript-eslint/utils'");
      expect(spec).toContain('languageOptions:');
      expect(spec).not.toContain("from '@typescript-eslint/rule-tester'");
      expect(spec).not.toContain('require.resolve');

      const packageJson = readJson(tree, 'package.json');
      expect(
        packageJson.devDependencies?.['@typescript-eslint/rule-tester']
      ).toBeUndefined();
    });
  });

  describe('--dir', () => {
    it('should support creating the rule in a nested directory', async () => {
      await lintWorkspaceRuleGenerator(tree, {
        name: 'another-rule',
        directory: 'some-dir',
      });

      expect(
        tree.read('tools/eslint-rules/some-dir/another-rule.ts', 'utf-8')
      ).toMatchSnapshot();

      expect(
        tree.read('tools/eslint-rules/some-dir/another-rule.spec.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should support creating the rule in a nested directory with multiple levels of nesting', async () => {
      await lintWorkspaceRuleGenerator(tree, {
        name: 'one-more-rule',
        directory: 'a/b/c',
      });

      expect(
        tree.read('tools/eslint-rules/a/b/c/one-more-rule.ts', 'utf-8')
      ).toMatchSnapshot();

      expect(
        tree.read('tools/eslint-rules/a/b/c/one-more-rule.spec.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });
});
