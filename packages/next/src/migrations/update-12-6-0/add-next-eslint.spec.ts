import { readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import addNextEslint from './add-next-eslint';

describe('Add next eslint 12.6.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add "next" config options', async () => {
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
      'apps/app1/.eslintrc.json',
      JSON.stringify({
        extends: ['../../.eslintrc.json'],
        ignorePatterns: ['!**/*'],
      })
    );

    await addNextEslint(tree);

    const result = readJson(tree, 'apps/app1/.eslintrc.json');
    expect(result.extends).toContain('next');
    expect(result.extends).toContain('next/core-web-vitals');
  });

  it('should add "next" config options when no "extends" property is present', async () => {
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
      'apps/app1/.eslintrc.json',
      JSON.stringify({
        ignorePatterns: ['!**/*'],
      })
    );

    await addNextEslint(tree);

    const result = readJson(tree, 'apps/app1/.eslintrc.json');
    expect(result.extends).toContain('next');
    expect(result.extends).toContain('next/core-web-vitals');
  });

  it('should add "next" config options when "extends" property is a string', async () => {
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
      'apps/app1/.eslintrc.json',
      JSON.stringify({
        extends: '../../.eslintrc.json',
        ignorePatterns: ['!**/*'],
      })
    );

    await addNextEslint(tree);

    const result = readJson(tree, 'apps/app1/.eslintrc.json');
    expect(result.extends).toContain('next');
    expect(result.extends).toContain('next/core-web-vitals');
    expect(result.extends).toContain('../../.eslintrc.json');
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
                executor: '@nrwl/web:build',
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
      'apps/app1/.eslintrc.json',
      JSON.stringify({
        extends: '../../.eslintrc.json',
        ignorePatterns: ['!**/*'],
      })
    );

    await addNextEslint(tree);

    expect(readJson(tree, 'apps/app1/.eslintrc.json')).toMatchObject({
      extends: '../../.eslintrc.json',
      ignorePatterns: ['!**/*'],
    });
  });

  it('should remove nx/react eslint plugin', async () => {
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
      'apps/app1/.eslintrc.json',
      JSON.stringify({
        extends: ['plugin:@nrwl/nx/react', '../../.eslintrc.json'],
      })
    );

    await addNextEslint(tree);

    expect(readJson(tree, 'apps/app1/.eslintrc.json').extends).not.toContain(
      'plugin:@nrwl/nx/react'
    );
  });
});
