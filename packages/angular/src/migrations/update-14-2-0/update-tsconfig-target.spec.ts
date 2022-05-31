import { logger, ProjectGraph, Tree } from '@nrwl/devkit';
import {
  addProjectConfiguration,
  DependencyType,
  readJson,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateTsConfigTarget from './update-tsconfig-target';

let projectGraph: ProjectGraph;
jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

describe('update-tsconfig-target migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
    jest.clearAllMocks();
  });

  it('should update target in "tsconfig.json" at the project root when it is an Angular project', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {},
    });
    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };
    writeJson(tree, 'apps/app1/tsconfig.json', {
      compilerOptions: { target: 'es2017' },
    });

    await updateTsConfigTarget(tree);

    const { compilerOptions } = readJson(tree, 'apps/app1/tsconfig.json');
    expect(compilerOptions.target).toBe('es2020');
  });

  it('should not update target in a tsconfig file referenced by a target option when it does not have the target set and there is a "tsconfig.json" at the project root', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: { tsConfig: 'apps/app1/tsconfig.app.json' },
        },
      },
    });
    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };
    writeJson(tree, 'apps/app1/tsconfig.json', {
      compilerOptions: { target: 'es2017' },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      compilerOptions: {},
    });

    await updateTsConfigTarget(tree);

    const { compilerOptions } = readJson(tree, 'apps/app1/tsconfig.json');
    expect(compilerOptions.target).toBe('es2020');
    const optionTsConfig = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(optionTsConfig.compilerOptions).toStrictEqual({});
  });

  it('should update target in a tsconfig file referenced by a target option when it has the target set and even if there is a "tsconfig.json" at the project root', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: { tsConfig: 'apps/app1/tsconfig.app.json' },
        },
      },
    });
    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };
    writeJson(tree, 'apps/app1/tsconfig.json', {
      compilerOptions: { target: 'es2017' },
    });
    writeJson(tree, 'apps/app1/tsconfig.app.json', {
      compilerOptions: { target: 'es2015' },
    });

    await updateTsConfigTarget(tree);

    const { compilerOptions } = readJson(tree, 'apps/app1/tsconfig.json');
    expect(compilerOptions.target).toBe('es2020');
    const optionTsConfig = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(optionTsConfig.compilerOptions.target).toBe('es2020');
  });

  it.each([
    ['@angular-devkit/build-angular:browser', 'tsconfig.app.json'],
    ['@angular-devkit/build-angular:karma', 'tsconfig.spec.json'],
    ['@nrwl/angular:webpack-browser', 'tsconfig.app.json'],
    ['@nrwl/angular:delegate-build', 'tsconfig.app.json'],
  ])(
    'should update target in the tsconfig file referenced by the target configuration when using the "%s" executor and there is no "tsconfig.json" at the project root',
    async (executor, tsConfig) => {
      const tsConfigPath = `apps/app1/${tsConfig}`;
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        sourceRoot: 'apps/app1/src',
        projectType: 'application',
        targets: {
          build: { executor, options: { tsConfig: tsConfigPath } },
        },
      });
      projectGraph = {
        dependencies: {
          app1: [
            {
              type: DependencyType.static,
              source: 'app1',
              target: 'npm:@angular/core',
            },
          ],
        },
        nodes: {},
      };
      writeJson(tree, tsConfigPath, {
        compilerOptions: { target: 'es2017' },
      });

      await updateTsConfigTarget(tree);

      const { compilerOptions } = readJson(tree, tsConfigPath);
      expect(compilerOptions.target).toBe('es2020');
    }
  );

  it.each([
    '@angular-devkit/build-angular:ng-packagr',
    '@nrwl/angular:ng-packagr-lite',
    '@nrwl/angular:package',
  ])(
    'should update target in the tsconfig file referenced by the target configuration when using the "%s" executor and there is no "tsconfig.json" at the project root',
    async (executor) => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        sourceRoot: 'libs/lib1/src',
        projectType: 'library',
        targets: {
          build: {
            executor,
            options: { tsConfig: 'libs/lib1/tsconfig.lib.json' },
            configurations: {
              production: { tsConfig: 'libs/lib1/tsconfig.lib.prod.json' },
            },
          },
        },
      });
      projectGraph = {
        dependencies: {
          lib1: [
            {
              type: DependencyType.static,
              source: 'lib1',
              target: 'npm:@angular/core',
            },
          ],
        },
        nodes: {},
      };
      writeJson(tree, 'libs/lib1/tsconfig.lib.json', {
        compilerOptions: { target: 'es2017' },
      });
      writeJson(tree, 'libs/lib1/tsconfig.lib.prod.json', {});

      await updateTsConfigTarget(tree);

      const { compilerOptions } = readJson(tree, 'libs/lib1/tsconfig.lib.json');
      expect(compilerOptions.target).toBe('es2020');
      const tsConfigProd = readJson(tree, 'libs/lib1/tsconfig.lib.prod.json');
      expect(tsConfigProd.compilerOptions.target).toBe('es2020');
    }
  );

  it('should not error and log a warning when the tsconfig file specified in target does not exist', async () => {
    jest.spyOn(logger, 'warn');
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nrwl/angular:package',
          options: { tsConfig: 'libs/lib1/tsconfig.lib.json' },
        },
      },
    });
    projectGraph = {
      dependencies: {
        lib1: [
          {
            type: DependencyType.static,
            source: 'lib1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };

    await expect(updateTsConfigTarget(tree)).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `The "libs/lib1/tsconfig.lib.json" file specified in the "build" target of the "lib1" project could not be found.`
      )
    );
  });

  it('should update target in tsconfig file specified in the jest config when it is an Angular project', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nrwl/jest:jest',
          options: { jestConfig: 'libs/lib1/jest.config.ts' },
        },
      },
    });
    projectGraph = {
      dependencies: {
        lib1: [
          {
            type: DependencyType.static,
            source: 'lib1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };
    tree.write(
      'libs/lib1/jest.config.ts',
      `export default {
      displayName: 'lib1',
      preset: '../../jest.preset.js',
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.spec.json',
          stringifyContentPathRegex: '\\.(html|svg)$',
        },
      },
      coverageDirectory: '../../coverage/libs/lib1',
      transform: {
        '^.+\\.(ts|mjs|js|html)$': 'jest-preset-angular',
      },
      transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
      snapshotSerializers: [
        'jest-preset-angular/build/serializers/no-ng-attributes',
        'jest-preset-angular/build/serializers/ng-snapshot',
        'jest-preset-angular/build/serializers/html-comment',
      ],
    };`
    );
    writeJson(tree, 'libs/lib1/tsconfig.spec.json', {
      compilerOptions: { target: 'es2017' },
    });

    await updateTsConfigTarget(tree);

    const { compilerOptions } = readJson(tree, 'libs/lib1/tsconfig.spec.json');
    expect(compilerOptions.target).toBe('es2020');
  });

  it('should not error and log a warning when the tsconfig file specified in the jest configuration does not exist', async () => {
    jest.spyOn(logger, 'warn');
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: { jestConfig: 'libs/lib1/jest.config.ts' },
        },
      },
    });
    projectGraph = {
      dependencies: {
        lib1: [
          {
            type: DependencyType.static,
            source: 'lib1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };
    tree.write(
      'libs/lib1/jest.config.ts',
      `export default {
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.spec.json',
          stringifyContentPathRegex: '\\.(html|svg)$',
        },
      },
    };`
    );

    await expect(updateTsConfigTarget(tree)).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `The "<rootDir>/tsconfig.spec.json" file specified in the Jest configuration file "libs/lib1/jest.config.ts" of the "test" target of the "lib1" project could not be found.`
      )
    );
  });

  it('should not error and log a warning when the jest configuration does not specify the "tsconfig"', async () => {
    jest.spyOn(logger, 'warn');
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: { jestConfig: 'libs/lib1/jest.config.ts' },
        },
      },
    });
    projectGraph = {
      dependencies: {
        lib1: [
          {
            type: DependencyType.static,
            source: 'lib1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };
    tree.write('libs/lib1/jest.config.ts', `export default {};`);

    await expect(updateTsConfigTarget(tree)).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `Couldn't find the "tsconfig" property for "ts-jest" in the Jest configuration file "libs/lib1/jest.config.ts" specified in the "test" target of the "lib1" project.`
      )
    );
  });

  it('should not error and log a warning when the jest configuration file does not exist', async () => {
    jest.spyOn(logger, 'warn');
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        test: {
          executor: '@nrwl/jest:jest',
          options: { jestConfig: 'libs/lib1/jest.config.ts' },
        },
      },
    });
    projectGraph = {
      dependencies: {
        lib1: [
          {
            type: DependencyType.static,
            source: 'lib1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };

    await expect(updateTsConfigTarget(tree)).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `The "libs/lib1/jest.config.ts" file specified in the "test" target of the "lib1" project could not be found.`
      )
    );
  });

  it('should not error and log a warning when the jest configuration file is not specified', async () => {
    jest.spyOn(logger, 'warn');
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: { test: { executor: '@nrwl/jest:jest', options: {} } },
    });
    projectGraph = {
      dependencies: {
        lib1: [
          {
            type: DependencyType.static,
            source: 'lib1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };

    await expect(updateTsConfigTarget(tree)).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `The "test" target of the "lib1" project is using the "@nrwl/jest:jest" executor but no "jestConfig" property was specified.`
      )
    );
  });

  it.each(['es2021', 'es2022', 'esnext'])(
    'should not update target when it is already set to a target greater than es2020 ("%s")',
    async (target) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        sourceRoot: 'apps/app1/src',
        projectType: 'library',
        targets: {
          build: {
            executor: '@angular-devkit/build-angular:browser',
            options: { tsConfig: 'apps/app1/tsconfig.other.json' },
          },
        },
      });
      projectGraph = {
        dependencies: {
          app1: [
            {
              type: DependencyType.static,
              source: 'app1',
              target: 'npm:@angular/core',
            },
          ],
        },
        nodes: {},
      };
      writeJson(tree, 'apps/app1/tsconfig.json', {
        compilerOptions: { target },
      });

      await updateTsConfigTarget(tree);

      const { compilerOptions } = readJson(tree, 'apps/app1/tsconfig.json');
      expect(compilerOptions.target).toBe(target);
    }
  );

  it('should not update target in "tsconfig.json" at the project root when it is not an angular project', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
    });
    projectGraph = {
      dependencies: {
        lib1: [
          {
            type: DependencyType.static,
            source: 'lib1',
            target: 'npm:lodash',
          },
        ],
      },
      nodes: {},
    };
    writeJson(tree, 'libs/lib1/tsconfig.json', {
      compilerOptions: { target: 'es2017' },
    });

    await updateTsConfigTarget(tree);

    const { compilerOptions } = readJson(tree, 'libs/lib1/tsconfig.json');
    expect(compilerOptions.target).toBe('es2017');
  });

  it('should not update target in a tsconfig file referenced by a target option when not using the relevant executors', async () => {
    jest.spyOn(logger, 'warn');
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@org/awesome-plugin:executor',
          options: { tsConfig: 'libs/lib1/tsconfig.other.json' },
        },
      },
    });
    projectGraph = {
      dependencies: {
        lib1: [
          {
            type: DependencyType.static,
            source: 'lib1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };
    writeJson(tree, 'libs/lib1/tsconfig.other.json', {
      compilerOptions: { target: 'es2017' },
    });

    await updateTsConfigTarget(tree);

    const { compilerOptions } = readJson(tree, 'libs/lib1/tsconfig.other.json');
    expect(compilerOptions.target).toBe('es2017');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'The "build" target of the "lib1" project is using an executor not supported by the migration.'
      )
    );
  });

  it('should not update target in a tsconfig file referenced by a target configuration when not using the relevant executors', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@org/awesome-plugin:executor',
          configurations: {
            production: { tsConfig: 'libs/lib1/tsconfig.other.json' },
          },
        },
      },
    });
    projectGraph = {
      dependencies: {
        lib1: [
          {
            type: DependencyType.static,
            source: 'lib1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };
    writeJson(tree, 'libs/lib1/tsconfig.other.json', {
      compilerOptions: { target: 'es2017' },
    });

    await updateTsConfigTarget(tree);

    const { compilerOptions } = readJson(tree, 'libs/lib1/tsconfig.other.json');
    expect(compilerOptions.target).toBe('es2017');
  });

  it('should not update target in workspace "tsconfig.base.json"', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: { tsConfig: 'apps/app1/tsconfig.json' },
        },
      },
    });
    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };
    writeJson(tree, 'apps/app1/tsconfig.json', {
      compilerOptions: { target: 'es2017' },
    });
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: { target: 'es2017' },
    });

    await updateTsConfigTarget(tree);

    const { compilerOptions } = readJson(tree, 'tsconfig.base.json');
    expect(compilerOptions.target).toBe('es2017');
  });

  it('should handle a tsconfig file with trailing commas and comments', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: { test: { executor: '@nrwl/angular:package' } },
    });
    projectGraph = {
      dependencies: {
        lib1: [
          {
            type: DependencyType.static,
            source: 'lib1',
            target: 'npm:@angular/core',
          },
        ],
      },
      nodes: {},
    };
    tree.write(
      'libs/lib1/tsconfig.json',
      `{
      /* some comment */
      "compilerOptions": {},
    }`
    );

    await expect(updateTsConfigTarget(tree)).resolves.not.toThrow();

    const { compilerOptions } = readJson(tree, 'libs/lib1/tsconfig.json');
    expect(compilerOptions.target).toBe('es2020');
  });
});
