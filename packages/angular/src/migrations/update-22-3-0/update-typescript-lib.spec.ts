import {
  addProjectConfiguration,
  readJson,
  writeJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-typescript-lib';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
}));

describe('update-typescript-lib migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should upgrade ES2020 to ES2022 when lib contains DOM and ES2020', async () => {
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
        lib: ['es2020', 'dom'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['dom', 'es2022']);
  });

  it('should upgrade ES2015 to ES2022 when lib contains DOM and ES2015', async () => {
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
        lib: ['es2015', 'dom'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['dom', 'es2022']);
  });

  it('should not modify when lib contains DOM and ES2022', async () => {
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
        lib: ['es2022', 'dom'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['es2022', 'dom']);
  });

  it('should not modify when lib contains DOM and esnext', async () => {
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
        lib: ['esnext', 'dom'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['esnext', 'dom']);
  });

  it('should not modify when lib contains DOM and ES2023', async () => {
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
        lib: ['es2023', 'dom'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['es2023', 'dom']);
  });

  it('should upgrade ES2020 to ES2022 when lib has ES2020 without DOM', async () => {
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
        lib: ['es2020'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['es2022']);
  });

  it('should upgrade ES2015 to ES2022 when lib has ES2015 without DOM', async () => {
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
        lib: ['es2015'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['es2022']);
  });

  it('should preserve other lib entries when upgrading ES version', async () => {
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
        lib: ['es2020', 'webworker'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['webworker', 'es2022']);
  });

  it('should not modify when lib contains ES2022 without DOM', async () => {
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
        lib: ['es2022'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['es2022']);
  });

  it('should not modify when lib contains esnext without DOM', async () => {
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
        lib: ['esnext'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['esnext']);
  });

  it('should not modify tsconfig when lib is not defined', async () => {
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
      compilerOptions: {},
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toBeUndefined();
  });

  it('should not modify tsconfig when lib is not an array', async () => {
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
        lib: 'es2020' as any,
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toBe('es2020');
  });

  it('should not modify tsconfig when lib has no ES entries', async () => {
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
        lib: ['dom', 'webworker'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['dom', 'webworker']);
  });

  it('should upgrade all ES versions to ES2022 when lib has multiple ES versions', async () => {
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
        lib: ['es2015', 'es2020', 'dom'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['dom', 'es2022']);
  });

  it('should update multiple tsconfig files in the same project', async () => {
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
        lib: ['es2020', 'dom'],
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.spec.json', {
      compilerOptions: {
        lib: ['es2020'],
      },
    });

    await migration(tree);

    const appConfig = readJson(tree, 'apps/app1/tsconfig.app.json');
    const specConfig = readJson(tree, 'apps/app1/tsconfig.spec.json');
    expect(appConfig.compilerOptions.lib).toEqual(['dom', 'es2022']);
    expect(specConfig.compilerOptions.lib).toEqual(['es2022']);
  });

  it('should update tsconfig files in multiple projects', async () => {
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
        lib: ['es2020', 'dom'],
      },
    });

    addProject('app2', {
      root: 'apps/app2',
      sourceRoot: 'apps/app2/src',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            tsConfig: 'apps/app2/tsconfig.app.json',
          },
        },
      },
    });
    writeJson(tree, 'apps/app2/tsconfig.app.json', {
      compilerOptions: {
        lib: ['es2020'],
      },
    });

    await migration(tree);

    const app1Config = readJson(tree, 'apps/app1/tsconfig.app.json');
    const app2Config = readJson(tree, 'apps/app2/tsconfig.app.json');
    expect(app1Config.compilerOptions.lib).toEqual(['dom', 'es2022']);
    expect(app2Config.compilerOptions.lib).toEqual(['es2022']);
  });

  it('should handle case-insensitive lib entries', async () => {
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
        lib: ['ES2020', 'DOM'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['DOM', 'es2022']);
  });

  it('should not modify when lib is already correct via inheritance from parent tsconfig', async () => {
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
    writeJson(tree, 'tsconfig.json', {
      compilerOptions: {
        lib: ['es2023', 'dom'],
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {},
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toBeUndefined();
  });

  it('should upgrade to ES2022 when parent has no lib and child has DOM with old ES', async () => {
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
    writeJson(tree, 'tsconfig.json', {
      compilerOptions: {},
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        lib: ['es2020', 'dom'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['dom', 'es2022']);
  });

  it('should upgrade to ES2022 when parent has old ES and child has DOM with old ES', async () => {
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
    writeJson(tree, 'tsconfig.json', {
      compilerOptions: {
        lib: ['es2015'],
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        lib: ['es2020', 'dom'],
      },
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['dom', 'es2022']);
  });

  it('should set explicit ES2022 when child inherits DOM with old ES from parent', async () => {
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
    writeJson(tree, 'tsconfig.json', {
      compilerOptions: {
        lib: ['es2020', 'dom'],
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {},
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['dom', 'es2022']);
  });

  it('should set explicit ES2022 when child inherits old ES without DOM from parent', async () => {
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
    writeJson(tree, 'tsconfig.json', {
      compilerOptions: {
        lib: ['es2020'],
      },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {},
    });

    await migration(tree);

    const config = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(config.compilerOptions.lib).toEqual(['es2022']);
  });

  function addProject(
    projectName: string,
    config: ProjectConfiguration,
    dependencies: string[] = ['npm:@angular/core']
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
