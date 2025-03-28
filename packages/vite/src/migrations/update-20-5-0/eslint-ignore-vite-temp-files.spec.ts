import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { isEslintInstalled } from '../../utils/ignore-vite-temp-files';
import migration from './eslint-ignore-vite-temp-files';

jest.mock('../../utils/ignore-vite-temp-files', () => ({
  ...jest.requireActual('../../utils/ignore-vite-temp-files'),
  isEslintInstalled: jest.fn(),
}));

describe('eslint-ignore-vite-temp-files migration', () => {
  let tree: Tree;
  let isEslintInstalledMock: jest.Mock;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    isEslintInstalledMock = (isEslintInstalled as jest.Mock).mockReturnValue(
      true
    );
  });

  it('should not throw an error if eslint is not installed', async () => {
    isEslintInstalledMock.mockReturnValue(false);

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should not throw an error if there are no eslint config files', async () => {
    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should only update the root eslint config when using flat config', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      targets: {},
    });
    tree.write('apps/app1/eslint.config.mjs', 'export default [];');

    await migration(tree);

    expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
      "export default [
        {
          ignores: ['**/vite.config.*.timestamp*', '**/vitest.config.*.timestamp*'],
        },
      ];
      "
    `);
    expect(tree.read('apps/app1/eslint.config.mjs', 'utf-8'))
      .toMatchInlineSnapshot(`
      "export default [];
      "
    `);
  });

  it('should update the project eslint config when using eslintrc config and it is using vite', async () => {
    tree.write(
      '.eslintrc.json',
      `{
  "ignorePatterns": ["**/*"]
}
`
    );
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      targets: {},
    });
    tree.write(
      'apps/app1/.eslintrc.json',
      `{
  "ignorePatterns": ["!**/*"]
}
`
    );
    tree.write('apps/app1/vite.config.ts', 'export default {};');
    addProjectConfiguration(tree, 'app2', {
      root: 'apps/app2',
      projectType: 'application',
      sourceRoot: 'apps/app2/src',
      targets: {},
    });
    tree.write(
      'apps/app2/.eslintrc.json',
      `{
  "ignorePatterns": ["!**/*"]
}
`
    );
    tree.write('apps/app2/vitest.config.ts', 'export default {};');
    // app not using vite, it should not be updated
    addProjectConfiguration(tree, 'app3', {
      root: 'apps/app3',
      projectType: 'application',
      sourceRoot: 'apps/app3/src',
      targets: {},
    });
    tree.write(
      'apps/app3/.eslintrc.json',
      `{
  "ignorePatterns": ["!**/*"]
}
`
    );

    await migration(tree);

    expect(tree.read('.eslintrc.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "ignorePatterns": ["**/*"]
      }
      "
    `);
    expect(tree.read('apps/app1/.eslintrc.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "ignorePatterns": [
          "!**/*",
          "**/vite.config.*.timestamp*",
          "**/vitest.config.*.timestamp*"
        ]
      }
      "
    `);
    expect(tree.read('apps/app2/.eslintrc.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "ignorePatterns": [
          "!**/*",
          "**/vite.config.*.timestamp*",
          "**/vitest.config.*.timestamp*"
        ]
      }
      "
    `);
    expect(tree.read('apps/app3/.eslintrc.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "ignorePatterns": ["!**/*"]
      }
      "
    `);
  });
});
