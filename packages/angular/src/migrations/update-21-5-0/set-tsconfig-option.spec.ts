import {
  addProjectConfiguration,
  getProjects,
  readProjectConfiguration,
  writeJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './set-tsconfig-option';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
  formatFiles: jest.fn(),
}));

describe('set-tsconfig-option migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = {
      dependencies: {},
      nodes: {},
    };
  });

  it.each(['@nx/angular:ng-packagr-lite', '@nx/angular:package'])(
    'should move tsConfig option from development configuration to options for %s',
    async (executor) => {
      const devTsConfig = 'libs/lib1/tsconfig.lib.dev.json';
      addProject('lib1', {
        root: 'libs/lib1',
        sourceRoot: 'libs/lib1/src',
        targets: {
          build: {
            executor,
            configurations: {
              development: {
                tsConfig: devTsConfig,
              },
            },
          },
        },
      });

      await migration(tree);

      const projectConfig = readProjectConfiguration(tree, 'lib1');
      expect(projectConfig.targets.build.options.tsConfig).toBe(devTsConfig);
      expect(
        projectConfig.targets.build.configurations.development
      ).toBeDefined();
      expect(
        projectConfig.targets.build.configurations.development.tsConfig
      ).toBeUndefined();
    }
  );

  it.each(['@nx/angular:ng-packagr-lite', '@nx/angular:package'])(
    'should not modify if tsConfig option already exists in options for %s',
    async (executor) => {
      const existingTsConfig = 'libs/lib1/tsconfig.lib.json';
      addProject('lib1', {
        root: 'libs/lib1',
        sourceRoot: 'libs/lib1/src',
        targets: {
          build: {
            executor,
            options: {
              tsConfig: existingTsConfig,
            },
            configurations: {
              development: {
                tsConfig: 'libs/lib1/tsconfig.lib.dev.json',
              },
            },
          },
        },
      });

      await migration(tree);

      const projectConfig = readProjectConfiguration(tree, 'lib1');
      expect(projectConfig.targets.build.options.tsConfig).toBe(
        existingTsConfig
      );
    }
  );

  it.each(['@nx/angular:ng-packagr-lite', '@nx/angular:package'])(
    'should handle missing development configuration gracefully for %s',
    async (executor) => {
      addProject('lib1', {
        root: 'libs/lib1',
        sourceRoot: 'libs/lib1/src',
        targets: {
          build: {
            executor,
            configurations: {
              production: {
                tsConfig: 'libs/lib1/tsconfig.lib.prod.json',
              },
            },
          },
        },
      });

      await migration(tree);

      const projectConfig = readProjectConfiguration(tree, 'lib1');
      expect(projectConfig.targets.build.options).toBeUndefined();
    }
  );

  it.each(['@nx/angular:ng-packagr-lite', '@nx/angular:package'])(
    'should handle missing tsConfig in development configuration for %s',
    async (executor) => {
      addProject('lib1', {
        root: 'libs/lib1',
        sourceRoot: 'libs/lib1/src',
        targets: {
          build: {
            executor,
            configurations: {
              development: {
                optimization: false,
              },
            },
          },
        },
      });

      await migration(tree);

      const projectConfig = readProjectConfiguration(tree, 'lib1');
      expect(projectConfig.targets.build.options).toBeUndefined();
      // Verify development configuration is unchanged
      expect(projectConfig.targets.build.configurations.development).toEqual({
        optimization: false,
      });
    }
  );

  it.each(['@nx/angular:ng-packagr-lite', '@nx/angular:package'])(
    'should preserve other development configuration properties when moving tsConfig for %s',
    async (executor) => {
      const devTsConfig = 'libs/lib1/tsconfig.lib.dev.json';
      addProject('lib1', {
        root: 'libs/lib1',
        sourceRoot: 'libs/lib1/src',
        targets: {
          build: {
            executor,
            configurations: {
              development: {
                tsConfig: devTsConfig,
                optimization: false,
                sourceMap: true,
              },
            },
          },
        },
      });

      await migration(tree);

      const projectConfig = readProjectConfiguration(tree, 'lib1');
      expect(projectConfig.targets.build.options.tsConfig).toBe(devTsConfig);
      // Verify tsConfig was removed but other properties remain
      expect(projectConfig.targets.build.configurations.development).toEqual({
        optimization: false,
        sourceMap: true,
      });
    }
  );

  it('should set tsConfig to tsconfig.spec.json when file exists for @nx/jest:jest', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        test: {
          executor: '@nx/jest:jest',
        },
      },
    });
    // Create the tsconfig.spec.json file
    writeJson(tree, 'apps/app1/tsconfig.spec.json', {
      extends: './tsconfig.json',
      compilerOptions: {
        module: 'commonjs',
        types: ['jest', 'node'],
      },
    });

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app1');
    expect(projectConfig.targets.test.options.tsConfig).toBe(
      'apps/app1/tsconfig.spec.json'
    );
  });

  it('should not set tsConfig when tsconfig.spec.json does not exist for @nx/jest:jest', async () => {
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        test: {
          executor: '@nx/jest:jest',
        },
      },
    });

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app1');
    expect(projectConfig.targets.test.options).toBeUndefined();
  });

  it('should not modify if tsConfig option already exists for @nx/jest:jest', async () => {
    const existingTsConfig = 'apps/app1/tsconfig.test.json';
    addProject('app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            tsConfig: existingTsConfig,
          },
        },
      },
    });
    // Create the tsconfig.spec.json file
    writeJson(tree, 'apps/app1/tsconfig.spec.json', {
      extends: './tsconfig.json',
      compilerOptions: {
        module: 'commonjs',
        types: ['jest', 'node'],
      },
    });

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app1');
    expect(projectConfig.targets.test.options.tsConfig).toBe(existingTsConfig);
  });

  it('should only process Angular projects with @angular/core dependency', async () => {
    // Add Angular project
    addProject('angular-app', {
      root: 'apps/angular-app',
      sourceRoot: 'apps/angular-app/src',
      targets: {
        test: {
          executor: '@nx/jest:jest',
        },
      },
    });
    // Add non-Angular project
    addProject(
      'react-app',
      {
        root: 'apps/react-app',
        sourceRoot: 'apps/react-app/src',
        targets: {
          test: {
            executor: '@nx/jest:jest',
          },
        },
      },
      ['npm:react']
    );
    // Create tsconfig files for both
    writeJson(tree, 'apps/angular-app/tsconfig.spec.json', {});
    writeJson(tree, 'apps/react-app/tsconfig.spec.json', {});

    await migration(tree);

    const angularConfig = readProjectConfiguration(tree, 'angular-app');
    expect(angularConfig.targets.test.options.tsConfig).toBe(
      'apps/angular-app/tsconfig.spec.json'
    );
    const reactConfig = readProjectConfiguration(tree, 'react-app');
    expect(reactConfig.targets.test.options).toBeUndefined();
  });

  it('should handle projects without targets', async () => {
    addProject('lib-no-targets', {
      root: 'libs/lib-no-targets',
      sourceRoot: 'libs/lib-no-targets/src',
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should update multiple targets in the same project', async () => {
    const devTsConfig = 'apps/app-multi-targets/tsconfig.app.dev.json';
    addProject('app-multi-targets', {
      root: 'apps/app-multi-targets',
      sourceRoot: 'apps/app-multi-targets/src',
      targets: {
        build: {
          executor: '@nx/angular:ng-packagr-lite',
          configurations: {
            development: {
              tsConfig: devTsConfig,
            },
          },
        },
        test: {
          executor: '@nx/jest:jest',
        },
      },
    });
    // Create the test tsconfig file
    writeJson(tree, 'apps/app-multi-targets/tsconfig.spec.json', {});

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app-multi-targets');
    expect(projectConfig.targets.build.options.tsConfig).toBe(devTsConfig);
    expect(
      projectConfig.targets.build.configurations.development
    ).toBeDefined();
    expect(
      projectConfig.targets.build.configurations.development.tsConfig
    ).toBeUndefined();
    expect(projectConfig.targets.test.options.tsConfig).toBe(
      'apps/app-multi-targets/tsconfig.spec.json'
    );
  });

  it('should handle fully inferred projects gracefully', async () => {
    // Add a project to the graph without adding it to the tree (simulating inferred project)
    projectGraph.nodes['inferred-project'] = {
      name: 'inferred-project',
      type: 'lib',
      data: {
        root: 'libs/inferred',
        sourceRoot: 'libs/inferred/src',
        targets: {
          test: {
            executor: '@nx/jest:jest',
          },
        },
      },
    };
    projectGraph.dependencies['inferred-project'] = [
      {
        source: 'inferred-project',
        target: 'npm:@angular/core',
        type: 'static',
      },
    ];

    // This should not throw an error
    await expect(migration(tree)).resolves.not.toThrow();
    // getProjects() do not return inferred projects, so verify we didn't add
    // it in the migration
    const projects = getProjects(tree);
    expect(projects.get('inferred-project')).toBeUndefined();
  });

  it('should not process targets with unrelated executors', async () => {
    addProject('app-other-executors', {
      root: 'apps/app-other-executors',
      sourceRoot: 'apps/app-other-executors/src',
      targets: {
        serve: {
          executor: '@angular-devkit/build-angular:dev-server',
        },
        lint: {
          executor: '@nx/eslint:lint',
        },
      },
    });

    await migration(tree);

    const projectConfig = readProjectConfiguration(tree, 'app-other-executors');
    expect(projectConfig.targets.serve.options).toBeUndefined();
    expect(projectConfig.targets.lint.options).toBeUndefined();
  });

  function addProject(
    projectName: string,
    config: ProjectConfiguration,
    dependencies: string[] = ['npm:@angular/core']
  ): void {
    projectGraph.nodes[projectName] = {
      data: config,
      name: projectName,
      type: 'app',
    };
    projectGraph.dependencies[projectName] = dependencies.map((d) => ({
      source: projectName,
      target: d,
      type: 'static',
    }));
    addProjectConfiguration(tree, projectName, config);
  }
});
