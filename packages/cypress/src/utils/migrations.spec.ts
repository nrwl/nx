import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { cypressProjectConfigs } from './migrations';

async function collectConfigPaths(tree: Tree): Promise<string[]> {
  const paths: string[] = [];
  for await (const { cypressConfigPath } of cypressProjectConfigs(tree)) {
    paths.push(cypressConfigPath);
  }
  return paths;
}

describe('cypressProjectConfigs', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should yield the config of every target using the cypress executor', async () => {
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: {
        build: { executor: '@nx/webpack:webpack' },
        e2e: {
          executor: '@nx/cypress:cypress',
          options: { cypressConfig: 'apps/app/cypress.config.ts' },
        },
        'component-test': {
          executor: '@nx/cypress:cypress',
          options: { cypressConfig: 'apps/app/cypress.ct.config.ts' },
        },
      },
    });

    expect(await collectConfigPaths(tree)).toEqual([
      'apps/app/cypress.config.ts',
      'apps/app/cypress.ct.config.ts',
    ]);
  });

  it('should yield each config path once across targets and configurations', async () => {
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: { cypressConfig: 'apps/app/cypress.config.ts' },
          configurations: {
            ci: { cypressConfig: 'apps/app/cypress.ci.config.ts' },
            production: { cypressConfig: 'apps/app/cypress.config.ts' },
          },
        },
        'e2e-ci': {
          executor: '@nx/cypress:cypress',
          options: { cypressConfig: 'apps/app/cypress.ci.config.ts' },
        },
      },
    });

    expect(await collectConfigPaths(tree)).toEqual([
      'apps/app/cypress.config.ts',
      'apps/app/cypress.ci.config.ts',
    ]);
  });

  it('should fall back to the config file in the project root when no target uses the executor', async () => {
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: { build: { executor: '@nx/webpack:webpack' } },
    });
    tree.write('apps/app/cypress.config.ts', '');

    expect(await collectConfigPaths(tree)).toEqual([
      'apps/app/cypress.config.ts',
    ]);
  });

  it('should skip projects without a cypress config', async () => {
    addProjectConfiguration(tree, 'lib', { root: 'libs/lib' });

    expect(await collectConfigPaths(tree)).toEqual([]);
  });
});
