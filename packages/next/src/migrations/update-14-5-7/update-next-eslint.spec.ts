import { addProjectConfiguration, readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateNextEslint } from './update-next-eslint';

describe('Add next eslint 14.5.7', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nrwl/next:build',
        },
      },
    });

    tree.write(
      'nx.json',
      JSON.stringify({
        projects: {
          app1: {},
        },
      })
    );
  });

  it('should update "next" config ignorePattern', async () => {
    tree.write(
      'apps/app1/.eslintrc.json',
      JSON.stringify({
        extends: ['../../.eslintrc.json'],
        ignorePatterns: ['!**/*'],
      })
    );

    await updateNextEslint(tree);

    const result = readJson(tree, 'apps/app1/.eslintrc.json');
    expect(result.ignorePatterns).toContain('.next/**/*');
  });

  it('should not update "next" config ignorePattern if .next pattern already exists', async () => {
    tree.write(
      'apps/app1/.eslintrc.json',
      JSON.stringify({
        extends: ['../../.eslintrc.json'],
        ignorePatterns: ['!**/*', '.next/**/*', '/foo/bar'],
      })
    );
    const before = readJson(tree, 'apps/app1/.eslintrc.json');

    await updateNextEslint(tree);

    const result = readJson(tree, 'apps/app1/.eslintrc.json');
    expect(result.ignorePatterns).toEqual(before.ignorePatterns);
  });
});
