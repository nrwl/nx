import { Tree, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { WORKSPACE_PLUGIN_DIR } from '../../constants';
import update from './rename-workspace-rules';

import 'nx/src/internal-testing-utils/mock-project-graph';

const rule1Name = 'test-rule';
const rule2Name = 'my-rule';

describe('update-17-2-6-rename-workspace-rules', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    const { lintWorkspaceRuleGenerator } = require('@nx/' +
      'eslint/src/generators/workspace-rule/workspace-rule');

    await lintWorkspaceRuleGenerator(tree, {
      name: rule1Name,
    });
    await lintWorkspaceRuleGenerator(tree, {
      name: rule2Name,
    });

    jest.mock(WORKSPACE_PLUGIN_DIR, () => ({
      rules: {
        [rule1Name]: {},
        [rule2Name]: {},
      },
    }));
  });

  it('should replace rules in config files', async () => {
    writeJson(tree, '.eslintrc.json', {
      plugins: ['@nx'],
      rules: {
        [`@nx/workspace/${rule1Name}`]: 'error',
        [`@nx/workspace/${rule2Name}`]: 'error',
      },
    });

    await update(tree);

    expect(Object.keys(readJson(tree, '.eslintrc.json').rules)).toEqual([
      '@nx/workspace-test-rule',
      '@nx/workspace-my-rule',
    ]);
  });

  it('should replace rules in random js files', async () => {
    tree.write(
      'custom.js',
      `
      export default {
        plugins: ['@nx'],
        rules: {
          "@nx/workspace/${rule1Name}": 'error',
          "@nx/workspace/${rule2Name}": 'error',
        },
      }
    `
    );

    await update(tree);

    expect(tree.read('custom.js', 'utf-8')).toContain(
      `@nx/workspace-test-rule`
    );
    expect(tree.read('custom.js', 'utf-8')).toContain(`@nx/workspace-my-rule`);
    expect(tree.read('custom.js', 'utf-8')).not.toContain(
      `@nx/workspace/test-rule`
    );
    expect(tree.read('custom.js', 'utf-8')).not.toContain(
      `@nx/workspace/my-rule`
    );
  });

  it('should replace rules in comments', async () => {
    tree.write(
      'custom.js',
      `import { getSourceNodes } from '@nx/workspace/src/utilities/typescript';

      // eslint-disable-next-line @nx/workspace/${rule1Name}
      import { something } from 'somewhere';

      /* eslint-disable @nx/workspace/${rule2Name} */
      // something that should remain the same @nx/workspace/unknown-rule
      /* eslint-enable @nx/workspace/${rule2Name} */
    `
    );

    await update(tree);

    expect(tree.read('custom.js', 'utf-8')).toMatchInlineSnapshot(`
      "import { getSourceNodes } from '@nx/workspace/src/utilities/typescript';

            // eslint-disable-next-line @nx/workspace-test-rule
            import { something } from 'somewhere';

            /* eslint-disable @nx/workspace-my-rule */
            // something that should remain the same @nx/workspace/unknown-rule
            /* eslint-enable @nx/workspace-my-rule */
          "
    `);
  });

  it('should not replace unknown rules', async () => {
    tree.write(
      'custom.js',
      `
      export default {
        plugins: ['@nx'],
        rules: {
          "@nx/workspace/random-rule": 'error',
        },
      }
    `
    );

    await update(tree);

    expect(tree.read('custom.js', 'utf-8')).not.toContain(
      `@nx/workspace-random-rule`
    );
    expect(tree.read('custom.js', 'utf-8')).toContain(
      `@nx/workspace/random-rule`
    );
  });
});
