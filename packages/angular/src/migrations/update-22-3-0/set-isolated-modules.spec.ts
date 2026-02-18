import {
  addProjectConfiguration,
  readJson,
  writeJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './set-isolated-modules';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
}));

describe('set-isolated-modules migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should set isolatedModules to true when not set', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        test: {
          executor: '@angular-devkit/build-angular:karma',
          options: {
            tsConfig: 'apps/app1/tsconfig.spec.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.spec.json', {
      extends: './tsconfig.json',
      compilerOptions: {},
    });

    await migration(tree);

    const specConfig = readJson(tree, 'apps/app1/tsconfig.spec.json');
    expect(specConfig.compilerOptions.isolatedModules).toBe(true);
  });

  it('should not modify when isolatedModules is already true', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        test: {
          executor: '@angular-devkit/build-angular:karma',
          options: {
            tsConfig: 'apps/app1/tsconfig.spec.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.spec.json', {
      compilerOptions: {
        isolatedModules: true,
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.spec.json');
    expect(config.compilerOptions.isolatedModules).toBe(true);
  });

  it('should not modify when isolatedModules is inherited from parent tsconfig', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        test: {
          executor: '@angular-devkit/build-angular:karma',
          options: {
            tsConfig: 'apps/app1/tsconfig.spec.json',
          },
        },
      },
    });
    // Base tsconfig with isolatedModules: true at the workspace root
    writeJson(tree, 'tsconfig.json', {
      compilerOptions: {
        isolatedModules: true,
      },
    });
    // App tsconfig in apps folder
    writeJson(tree, 'apps/tsconfig.json', {
      extends: '../tsconfig.json',
      compilerOptions: {},
    });
    // App-specific tsconfig extends the apps tsconfig (inherits the values)
    writeJson(tree, 'apps/app1/tsconfig.spec.json', {
      extends: '../tsconfig.json',
      compilerOptions: {},
    });

    await migration(tree);

    // Should not add duplicate settings since they're inherited
    const config = readJson(tree, 'apps/app1/tsconfig.spec.json');
    expect(config.compilerOptions.isolatedModules).toBeUndefined();
  });

  it('should update tsconfig.spec.json files in multiple projects', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        test: {
          executor: '@angular-devkit/build-angular:karma',
          options: {
            tsConfig: 'apps/app1/tsconfig.spec.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.spec.json', {
      compilerOptions: {},
    });

    addProject('app2', {
      root: 'apps/app2',
      sourceRoot: 'apps/app2/src',
      targets: {
        test: {
          executor: '@angular-devkit/build-angular:karma',
          options: {
            tsConfig: 'apps/app2/tsconfig.spec.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app2/tsconfig.spec.json', {
      compilerOptions: {},
    });

    await migration(tree);

    const app1Config = readJson(tree, 'apps/app1/tsconfig.spec.json');
    const app2Config = readJson(tree, 'apps/app2/tsconfig.spec.json');
    expect(app1Config.compilerOptions.isolatedModules).toBe(true);
    expect(app2Config.compilerOptions.isolatedModules).toBe(true);
  });

  it('should handle custom tsConfig paths from test target options', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            tsConfig: 'apps/app1/tsconfig.spec.custom.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.spec.custom.json', {
      compilerOptions: {},
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.spec.custom.json');
    expect(config.compilerOptions.isolatedModules).toBe(true);
  });

  it('should update tsconfig.spec.json even without test target', async () => {
    addProject('lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      targets: {},
    });
    writeJson(tree, 'libs/lib1/tsconfig.spec.json', {
      compilerOptions: {},
    });

    await migration(tree);

    const specConfig = readJson(tree, 'libs/lib1/tsconfig.spec.json');
    expect(specConfig.compilerOptions.isolatedModules).toBe(true);
  });

  it('should set isolatedModules when explicitly set to false', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        test: {
          executor: '@angular-devkit/build-angular:karma',
          options: {
            tsConfig: 'apps/app1/tsconfig.spec.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.spec.json', {
      compilerOptions: {
        isolatedModules: false,
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.spec.json');
    expect(config.compilerOptions.isolatedModules).toBe(true);
  });

  it('should set isolatedModules when inherited value is false', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        test: {
          executor: '@angular-devkit/build-angular:karma',
          options: {
            tsConfig: 'apps/app1/tsconfig.spec.json',
          },
        },
      },
    });
    writeJson(tree, 'tsconfig.json', {
      compilerOptions: {
        isolatedModules: false,
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.spec.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {},
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.spec.json');
    expect(config.compilerOptions.isolatedModules).toBe(true);
  });

  function addProject(
    projectName: string,
    config: ProjectConfiguration,
    dependencies: string[] = ['npm:@angular/core', 'npm:jest-preset-angular']
  ): void {
    projectGraph = {
      dependencies: {
        ...(projectGraph?.dependencies || {}),
        [projectName]: dependencies.map((d) => ({
          source: projectName,
          target: d,
          type: 'static',
        })),
      },
      nodes: {
        ...(projectGraph?.nodes || {}),
        [projectName]: { data: config, name: projectName, type: 'app' },
      },
    };
    addProjectConfiguration(tree, projectName, config);
  }
});
