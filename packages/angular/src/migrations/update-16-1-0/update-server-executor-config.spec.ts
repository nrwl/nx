import type { Tree } from '@nx/devkit';
import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-server-executor-config';

describe.each([
  '@angular-devkit/build-angular:server',
  '@nx/angular:server',
  '@nrwl/angular:server',
])('update-server-executor-config migration', (executor) => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should add 'buildOptimizer: false' to config with 'optimization: false' (${executor})`, async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        server: {
          executor,
          configurations: {
            development: { optimization: false },
            production: { optimization: true },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(
      project.targets.server.configurations.development.buildOptimizer
    ).toBe(false);
  });

  it(`should not add 'buildOptimizer' option to config when 'optimization' is not defined (${executor})`, async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        server: {
          executor,
          options: {},
          configurations: {
            development: { optimization: false },
            production: { optimization: true },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.server.options.buildOptimizer).toBeUndefined();
  });

  it(`should add 'buildOptimizer: true' to config with 'optimization: true' (${executor})`, async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        server: {
          executor,
          options: {},
          configurations: {
            development: { optimization: false },
            production: { optimization: true },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(
      project.targets.server.configurations.production.buildOptimizer
    ).toBe(true);
  });

  it(`should not change 'buildOptimizer' if already set (${executor})`, async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        server: {
          executor,
          options: {},
          configurations: {
            development: {
              optimization: false,
              buildOptimizer: true,
            },
            production: { optimization: true },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(
      project.targets.server.configurations.development.buildOptimizer
    ).toBe(true);
  });
});
