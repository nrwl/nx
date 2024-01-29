import { addProjectConfiguration, readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './add-browser-sync-dependency';

describe('add-browser-sync-dependency migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add "browser-sync" as devDependencies when "@angular-devkit/build-angular:ssr-dev-server" is used', async () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      projectType: 'application',
      targets: {
        'ssr-dev-server': {
          executor: '@angular-devkit/build-angular:ssr-dev-server',
        },
      },
    });

    await migration(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['browser-sync']).toEqual('^3.0.0');
  });

  it('should add "browser-sync" as devDependencies when "@nx/angular:module-federation-dev-ssr" is used', async () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      projectType: 'application',
      targets: {
        'ssr-dev-server': {
          executor: '@nx/angular:module-federation-dev-ssr',
        },
      },
    });

    await migration(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['browser-sync']).toEqual('^3.0.0');
  });

  it('should not add "browser-sync" as devDependencies when relevant executors are not used', async () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      projectType: 'application',
      targets: {
        'ssr-dev-server': {
          executor: '@nx/angular:application',
        },
      },
    });

    await migration(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['browser-sync']).toBeUndefined();
  });
});
