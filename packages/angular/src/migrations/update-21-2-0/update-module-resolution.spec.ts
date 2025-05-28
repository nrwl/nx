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

  it('should update moduleResolution in project-specific tsconfig files', async () => {
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
      extends: '../tsconfig.json',
      compilerOptions: {
        module: 'es2020',
        moduleResolution: 'node',
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.spec.json', {
      extends: '../tsconfig.json',
      compilerOptions: {
        module: 'es2020',
        moduleResolution: 'node',
      },
    });

    await migration(tree);

    const appConfig = readJson(tree, 'apps/app1/tsconfig.app.json');
    const specConfig = readJson(tree, 'apps/app1/tsconfig.spec.json');
    expect(appConfig.compilerOptions.moduleResolution).toBe('bundler');
    expect(specConfig.compilerOptions.moduleResolution).toBe('bundler');
  });

  it('should not update moduleResolution when module is "preserve"', async () => {
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
        moduleResolution: 'node',
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.moduleResolution).toBe('node');
  });

  it('should not update moduleResolution when it is already "bundler"', async () => {
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
        module: 'es2020',
        moduleResolution: 'bundler',
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.moduleResolution).toBe('bundler');
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
