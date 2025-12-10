import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  addProjectConfiguration,
} from '@nx/devkit';
import migration from './remove-deprecated-options';

describe('remove-deprecated-options migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove deleteOutputPath from options', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: {
            outputPath: 'dist/apps/app1',
            deleteOutputPath: true,
            main: 'apps/app1/src/main.ts',
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
      },
    });

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app1');
    expect(projectConfig.targets.build.options).not.toHaveProperty(
      'deleteOutputPath'
    );
    expect(projectConfig.targets.build.options.outputPath).toBe(
      'dist/apps/app1'
    );
    expect(projectConfig.targets.build.options.main).toBe(
      'apps/app1/src/main.ts'
    );
  });

  it('should remove sassImplementation from options', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: {
            outputPath: 'dist/apps/app1',
            sassImplementation: 'sass',
            main: 'apps/app1/src/main.ts',
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
      },
    });

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app1');
    expect(projectConfig.targets.build.options).not.toHaveProperty(
      'sassImplementation'
    );
    expect(projectConfig.targets.build.options.outputPath).toBe(
      'dist/apps/app1'
    );
    expect(projectConfig.targets.build.options.main).toBe(
      'apps/app1/src/main.ts'
    );
  });

  it('should remove both deleteOutputPath and sassImplementation from options', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: {
            outputPath: 'dist/apps/app1',
            deleteOutputPath: false,
            sassImplementation: 'sass-embedded',
            main: 'apps/app1/src/main.ts',
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
      },
    });

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app1');
    expect(projectConfig.targets.build.options).not.toHaveProperty(
      'deleteOutputPath'
    );
    expect(projectConfig.targets.build.options).not.toHaveProperty(
      'sassImplementation'
    );
    expect(projectConfig.targets.build.options.outputPath).toBe(
      'dist/apps/app1'
    );
    expect(projectConfig.targets.build.options.main).toBe(
      'apps/app1/src/main.ts'
    );
  });

  it('should remove deleteOutputPath from configurations', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: {
            outputPath: 'dist/apps/app1',
            main: 'apps/app1/src/main.ts',
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
          configurations: {
            production: {
              deleteOutputPath: true,
              optimization: true,
            },
            development: {
              deleteOutputPath: false,
              optimization: false,
            },
          },
        },
      },
    });

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app1');
    expect(
      projectConfig.targets.build.configurations.production
    ).not.toHaveProperty('deleteOutputPath');
    expect(
      projectConfig.targets.build.configurations.development
    ).not.toHaveProperty('deleteOutputPath');
    expect(
      projectConfig.targets.build.configurations.production.optimization
    ).toBe(true);
    expect(
      projectConfig.targets.build.configurations.development.optimization
    ).toBe(false);
  });

  it('should remove sassImplementation from configurations', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: {
            outputPath: 'dist/apps/app1',
            main: 'apps/app1/src/main.ts',
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
          configurations: {
            production: {
              sassImplementation: 'sass',
              optimization: true,
            },
            development: {
              sassImplementation: 'sass-embedded',
              optimization: false,
            },
          },
        },
      },
    });

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app1');
    expect(
      projectConfig.targets.build.configurations.production
    ).not.toHaveProperty('sassImplementation');
    expect(
      projectConfig.targets.build.configurations.development
    ).not.toHaveProperty('sassImplementation');
    expect(
      projectConfig.targets.build.configurations.production.optimization
    ).toBe(true);
    expect(
      projectConfig.targets.build.configurations.development.optimization
    ).toBe(false);
  });

  it('should handle both @nx/webpack and @nrwl/webpack executors', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
          options: {
            outputPath: 'dist/apps/app1',
            deleteOutputPath: true,
            sassImplementation: 'sass',
            main: 'apps/app1/src/main.ts',
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
      },
    });

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app1');
    expect(projectConfig.targets.build.options).not.toHaveProperty(
      'deleteOutputPath'
    );
    expect(projectConfig.targets.build.options).not.toHaveProperty(
      'sassImplementation'
    );
  });

  it('should not modify projects with other executors', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/vite:build',
          options: {
            outputPath: 'dist/apps/app1',
            deleteOutputPath: true,
            sassImplementation: 'sass',
            main: 'apps/app1/src/main.ts',
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
      },
    });

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app1');
    expect(projectConfig.targets.build.options.deleteOutputPath).toBe(true);
    expect(projectConfig.targets.build.options.sassImplementation).toBe('sass');
  });

  it('should handle projects with no targets', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should handle targets with no options', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
        },
      },
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should handle multiple projects', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: {
            outputPath: 'dist/apps/app1',
            deleteOutputPath: true,
            main: 'apps/app1/src/main.ts',
            tsConfig: 'apps/app1/tsconfig.app.json',
          },
        },
      },
    });

    addProjectConfiguration(tree, 'app2', {
      root: 'apps/app2',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: {
            outputPath: 'dist/apps/app2',
            sassImplementation: 'sass',
            main: 'apps/app2/src/main.ts',
            tsConfig: 'apps/app2/tsconfig.app.json',
          },
          configurations: {
            production: {
              deleteOutputPath: false,
              sassImplementation: 'sass-embedded',
            },
          },
        },
      },
    });

    await migration(tree);

    const app1Config = readProjectConfiguration(tree, 'app1');
    const app2Config = readProjectConfiguration(tree, 'app2');

    expect(app1Config.targets.build.options).not.toHaveProperty(
      'deleteOutputPath'
    );
    expect(app2Config.targets.build.options).not.toHaveProperty(
      'sassImplementation'
    );
    expect(
      app2Config.targets.build.configurations.production
    ).not.toHaveProperty('deleteOutputPath');
    expect(
      app2Config.targets.build.configurations.production
    ).not.toHaveProperty('sassImplementation');
  });
});
