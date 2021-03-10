import { readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import removeTsconfigApp from './remove-tsconfig-app-11-5-0';

describe('Remove tsconfig.app.json 11.5.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove tsconfig.app.json', async () => {
    tree.write(
      'workspace.json',
      JSON.stringify({
        projects: {
          app1: {
            root: 'apps/app1',
            targets: {
              build: {
                executor: '@nrwl/next:build',
              },
            },
          },
        },
      })
    );
    tree.write(
      'nx.json',
      JSON.stringify({
        projects: {
          app1: {},
        },
      })
    );
    tree.write(
      'apps/app1/tsconfig.json',
      JSON.stringify({
        include: [],
      })
    );
    tree.write(
      'apps/app1/tsconfig.app.json',
      JSON.stringify({
        extends: './tsconfig.json',
      })
    );

    await removeTsconfigApp(tree);

    expect(tree.exists('apps/app1/tsconfig.app.json')).toBe(false);
  });

  it('should update tsconfig.json with "include" from tsconfig.app.json', async () => {
    tree.write(
      'workspace.json',
      JSON.stringify({
        projects: {
          app1: {
            root: 'apps/app1',
            targets: {
              build: {
                executor: '@nrwl/next:build',
              },
            },
          },
        },
      })
    );
    tree.write(
      'nx.json',
      JSON.stringify({
        projects: {
          app1: {},
        },
      })
    );
    tree.write(
      'apps/app1/tsconfig.json',
      JSON.stringify({
        include: [],
      })
    );
    tree.write(
      'apps/app1/tsconfig.app.json',
      JSON.stringify({
        extends: './tsconfig.json',
        include: ['**/*.ts', '**/*.tsx', 'next-env.d.ts'],
      })
    );

    await removeTsconfigApp(tree);

    expect(readJson(tree, 'apps/app1/tsconfig.json')).toMatchObject({
      include: ['**/*.ts', '**/*.tsx', 'next-env.d.ts'],
    });
  });

  it('should update tsconfig.json to remove "references"', async () => {
    tree.write(
      'workspace.json',
      JSON.stringify({
        projects: {
          app1: {
            root: 'apps/app1',
            targets: {
              build: {
                executor: '@nrwl/next:build',
              },
            },
          },
        },
      })
    );
    tree.write(
      'nx.json',
      JSON.stringify({
        projects: {
          app1: {},
        },
      })
    );
    tree.write(
      'apps/app1/tsconfig.json',
      JSON.stringify({
        references: [
          {
            path: './tsconfig.app.json',
          },
        ],
      })
    );
    tree.write(
      'apps/app1/tsconfig.app.json',
      JSON.stringify({
        extends: './tsconfig.json',
      })
    );

    await removeTsconfigApp(tree);

    expect(
      readJson(tree, 'apps/app1/tsconfig.json').references
    ).toBeUndefined();
  });

  it('should not change projects that are not next.js', async () => {
    tree.write(
      'workspace.json',
      JSON.stringify({
        projects: {
          app1: {
            root: 'apps/app1',
            targets: {
              build: {
                executor: '@nrwl/react:build',
              },
            },
          },
        },
      })
    );
    tree.write(
      'nx.json',
      JSON.stringify({
        projects: {
          app1: {},
        },
      })
    );
    tree.write(
      'apps/app1/tsconfig.json',
      JSON.stringify({
        include: [],
      })
    );
    tree.write(
      'apps/app1/tsconfig.app.json',
      JSON.stringify({
        extends: './tsconfig.json',
      })
    );

    await removeTsconfigApp(tree);

    expect(tree.exists('apps/app1/tsconfig.app.json')).toBe(true);
  });
});
