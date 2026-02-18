import {
  addProjectConfiguration,
  readJson,
  writeJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-module-resolution';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
}));

describe('update-module-resolution migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should set both module and moduleResolution when neither is set', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      extends: '../tsconfig.json',
      compilerOptions: {},
    });

    await migration(tree);

    const appConfig = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(appConfig.compilerOptions.module).toBe('preserve');
    expect(appConfig.compilerOptions.moduleResolution).toBe('bundler');
  });

  it('should set both module and moduleResolution when only module is set to es2020', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      extends: '../tsconfig.json',
      compilerOptions: {
        module: 'es2020',
      },
    });

    await migration(tree);

    const appConfig = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(appConfig.compilerOptions.module).toBe('preserve');
    expect(appConfig.compilerOptions.moduleResolution).toBe('bundler');
  });

  it('should set both module and moduleResolution when only moduleResolution is set to node', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      extends: '../tsconfig.json',
      compilerOptions: {
        moduleResolution: 'node',
      },
    });

    await migration(tree);

    const appConfig = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(appConfig.compilerOptions.module).toBe('preserve');
    expect(appConfig.compilerOptions.moduleResolution).toBe('bundler');
  });

  it('should not update when both module and moduleResolution are already correct', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      compilerOptions: {
        module: 'preserve',
        moduleResolution: 'bundler',
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.module).toBe('preserve');
    expect(config.compilerOptions.moduleResolution).toBe('bundler');
  });

  it('should handle tsconfig with extends correctly', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
      },
    });
    // Base tsconfig with preserve and bundler at the workspace root
    writeJson(tree, 'tsconfig.json', {
      compilerOptions: {
        module: 'preserve',
        moduleResolution: 'bundler',
      },
    });
    // App tsconfig in apps folder
    writeJson(tree, 'apps/tsconfig.json', {
      extends: '../tsconfig.json',
      compilerOptions: {},
    });
    // App-specific tsconfig extends the apps tsconfig (inherits the values)
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      extends: '../tsconfig.json',
      compilerOptions: {},
    });

    await migration(tree);

    // Should not add duplicate settings since they're inherited
    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    // The migration should skip this file since readCompilerOptionsFromTsConfig
    // resolves the inherited values and sees they're already correct
    expect(config.compilerOptions.module).toBeUndefined();
    expect(config.compilerOptions.moduleResolution).toBeUndefined();
  });

  it('should update multiple Angular project tsconfig files', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
        test: {
          executor: '@angular-devkit/build-angular:karma',
          options: {
            tsConfig: 'apps/app1/tsconfig.spec.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      compilerOptions: {
        module: 'es2020',
        moduleResolution: 'node',
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.spec.json', {
      compilerOptions: {
        module: 'es2020',
        moduleResolution: 'node',
      },
    });

    await migration(tree);

    const appConfig = readJson(tree, 'apps/app1/tsconfig.app.json');
    const specConfig = readJson(tree, 'apps/app1/tsconfig.spec.json');
    expect(appConfig.compilerOptions.module).toBe('preserve');
    expect(appConfig.compilerOptions.moduleResolution).toBe('bundler');
    expect(specConfig.compilerOptions.module).toBe('preserve');
    expect(specConfig.compilerOptions.moduleResolution).toBe('bundler');
  });

  it('should update known tsconfig files for non-buildable libraries without tsConfig in targets', async () => {
    addProject('lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      targets: {},
    });
    writeJson(tree, 'libs/lib1/tsconfig.json', {
      compilerOptions: {
        module: 'es2020',
      },
    });
    writeJson(tree, 'libs/lib1/tsconfig.lib.json', {
      extends: './tsconfig.json',
      compilerOptions: {
        moduleResolution: 'node',
      },
    });
    writeJson(tree, 'libs/lib1/tsconfig.spec.json', {
      extends: './tsconfig.json',
      compilerOptions: {},
    });

    await migration(tree);

    const baseConfig = readJson(tree, 'libs/lib1/tsconfig.json');
    const libConfig = readJson(tree, 'libs/lib1/tsconfig.lib.json');
    const specConfig = readJson(tree, 'libs/lib1/tsconfig.spec.json');
    expect(baseConfig.compilerOptions.module).toBe('preserve');
    expect(baseConfig.compilerOptions.moduleResolution).toBe('bundler');
    expect(libConfig.compilerOptions.module).toBe('preserve');
    expect(libConfig.compilerOptions.moduleResolution).toBe('bundler');
    expect(specConfig.compilerOptions.module).toBeUndefined(); // inherited from tsconfig.json
    expect(specConfig.compilerOptions.moduleResolution).toBeUndefined(); // inherited from tsconfig.json
  });

  it('should not update tsconfig.server.json - handled by update-ssr-webpack-config migration', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:application',
          options: {
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
        server: {
          executor: '@angular-devkit/build-angular:server',
          options: {
            tsConfig: 'apps/app1/tsconfig.server.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      compilerOptions: {
        module: 'es2020',
        moduleResolution: 'node',
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.server.json', {
      compilerOptions: {
        module: 'es2020',
        moduleResolution: 'node',
      },
    });

    await migration(tree);

    // tsconfig.app.json should be updated
    const appConfig = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(appConfig.compilerOptions.module).toBe('preserve');
    expect(appConfig.compilerOptions.moduleResolution).toBe('bundler');
    // tsconfig.server.json should NOT be updated - left for update-ssr-webpack-config migration
    const serverConfig = readJson(tree, 'apps/app1/tsconfig.server.json');
    expect(serverConfig.compilerOptions.module).toBe('es2020');
    expect(serverConfig.compilerOptions.moduleResolution).toBe('node');
  });

  function addProject(
    projectName: string,
    config: ProjectConfiguration,
    dependencies: string[] = ['npm:@angular/core']
  ): void {
    projectGraph = {
      dependencies: {
        [projectName]: dependencies.map((d) => ({
          source: projectName,
          target: d,
          type: 'static',
        })),
      },
      nodes: {
        [projectName]: { data: config, name: projectName, type: 'app' },
      },
    };
    addProjectConfiguration(tree, projectName, config);
  }
});
