import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import {
  readJson,
  readNxJson,
  readProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { MigrationProjectConfiguration } from '../../utilities';
import { LibMigrator } from './lib.migrator';

type AngularCliProjectConfiguration = Omit<ProjectConfiguration, 'targets'> & {
  architect?: {
    [targetName: string]: Omit<TargetConfiguration, 'executor'> & {
      builder: string;
    };
  };
};

const mockedLogger = { warn: jest.fn() };

describe('lib migrator', () => {
  let tree: Tree;

  function addProject(
    name: string,
    config: AngularCliProjectConfiguration
  ): MigrationProjectConfiguration {
    config.projectType = 'library';
    const angularJson = readJson(tree, 'angular.json');
    angularJson.projects[name] = config;
    writeJson(tree, 'angular.json', angularJson);
    tree.write(`${config.root}/README.md`, '');
    tree.write(`${config.sourceRoot ?? config.root}/public-api.ts`, '');

    return { config: readProjectConfiguration(tree, name), name };
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // when this migrator is invoked, some of the workspace migration has
    // already been run, so we make some adjustments to match that state
    writeJson(tree, 'angular.json', { version: 2, projects: {} });

    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('should fail validation when the project root is not specified', async () => {
      const project = addProject('lib1', {} as any);
      const migrator = new LibMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The project root is not defined in the project configuration. The project will be skipped.'
      );
      expect(result[0].hint).toBe(
        'Make sure to manually migrate its configuration and files or remove the project if it is not valid. Alternatively, you could revert the migration, ensure the value for "projects.lib1.root" is set and run the migration again.'
      );
    });

    it('should fail validation when the project root is not valid', async () => {
      const project = addProject('lib1', { root: 'projects/lib1' });
      const migrator = new LibMigrator(
        tree,
        {},
        {
          ...project,
          config: { ...project.config, root: 'projects/wrong-lib1' },
        }
      );

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The project root "projects/wrong-lib1" could not be found. The project will be skipped.'
      );
      expect(result[0].hint).toBe(
        'Make sure to manually migrate its configuration and files or remove the project if it is not valid. Alternatively, you could revert the migration, ensure the value for "projects.lib1.root" is correct and run the migration again.'
      );
    });

    it('should fail validation when the project source root is specified and it is not valid', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
      });
      const migrator = new LibMigrator(
        tree,
        {},
        {
          ...project,
          config: { ...project.config, sourceRoot: 'projects/lib1/wrong-src' },
        }
      );

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The project source root "projects/lib1/wrong-src" could not be found. The project will be skipped.'
      );
      expect(result[0].hint).toBe(
        'Make sure to manually migrate its configuration and files or remove the project if it is not valid. Alternatively, you could revert the migration, ensure the value for "projects.lib1.sourceRoot" is correct and run the migration again.'
      );
    });

    it('should fail validation when the project is using unsupported builders', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: { build: { builder: '@not/supported:builder' } },
      });
      const migrator = new LibMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].messageGroup.title).toBe('Unsupported builders');
      expect(result[0].messageGroup.messages).toStrictEqual([
        `The "build" target is using a builder "@not/supported:builder" that's not currently supported by the automated migration. The target will be skipped.`,
      ]);
      expect(result[0].hint).toMatchInlineSnapshot(
        `"Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could revert the migration, change the builder to one of the builders supported by the automated migration ("@angular-devkit/build-angular:ng-packagr", "@angular-devkit/build-angular:karma" and "@angular-eslint/builder:lint"), and run the migration again."`
      );
    });

    it('should fail validation with an error message per target using an unsupported builder', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          build: { builder: '@not/supported:builder' },
          test: { builder: '@other/not-supported:builder' },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].messageGroup.title).toBe('Unsupported builders');
      expect(result[0].messageGroup.messages).toStrictEqual([
        `The "build" target is using a builder "@not/supported:builder" that's not currently supported by the automated migration. The target will be skipped.`,
        `The "test" target is using a builder "@other/not-supported:builder" that's not currently supported by the automated migration. The target will be skipped.`,
      ]);
      expect(result[0].hint).toMatchInlineSnapshot(
        `"Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could revert the migration, change the builder to one of the builders supported by the automated migration ("@angular-devkit/build-angular:ng-packagr", "@angular-devkit/build-angular:karma" and "@angular-eslint/builder:lint"), and run the migration again."`
      );
    });

    it('should still fail validation when the target name is not a common one', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: { 'my-build': { builder: '@not/supported:builder' } },
      });
      const migrator = new LibMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].messageGroup.title).toBe('Unsupported builders');
      expect(result[0].messageGroup.messages).toStrictEqual([
        `The "my-build" target is using a builder "@not/supported:builder" that's not currently supported by the automated migration. The target will be skipped.`,
      ]);
      expect(result[0].hint).toMatchInlineSnapshot(
        `"Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could revert the migration, change the builder to one of the builders supported by the automated migration ("@angular-devkit/build-angular:ng-packagr", "@angular-devkit/build-angular:karma" and "@angular-eslint/builder:lint"), and run the migration again."`
      );
    });

    it('should fail validation when there are multiple targets for the same builder', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          build1: { builder: '@angular-devkit/build-angular:ng-packagr' },
          build2: { builder: '@angular-devkit/build-angular:ng-packagr' },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'There is more than one target using the builder "@angular-devkit/build-angular:ng-packagr": "build1" and "build2". This is not currently supported by the automated migration. These targets will be skipped.'
      );
      expect(result[0].hint).toBe(
        'Make sure to manually migrate their configuration and any possible associated files.'
      );
    });

    it('should fail validation with multiple errors when there are multiple targets for the same builders', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          build1: { builder: '@angular-devkit/build-angular:ng-packagr' },
          build2: { builder: '@angular-devkit/build-angular:ng-packagr' },
          lint1: { builder: '@angular-eslint/builder:lint' },
          lint2: { builder: '@angular-eslint/builder:lint' },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(2);
      expect(result[0].message).toBe(
        'There is more than one target using the builder "@angular-devkit/build-angular:ng-packagr": "build1" and "build2". This is not currently supported by the automated migration. These targets will be skipped.'
      );
      expect(result[0].hint).toBe(
        'Make sure to manually migrate their configuration and any possible associated files.'
      );
      expect(result[1].message).toBe(
        'There is more than one target using the builder "@angular-eslint/builder:lint": "lint1" and "lint2". This is not currently supported by the automated migration. These targets will be skipped.'
      );
      expect(result[1].hint).toBe(
        'Make sure to manually migrate their configuration and any possible associated files.'
      );
    });

    it('should succeed validation', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          build: { builder: '@angular-devkit/build-angular:ng-packagr' },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toBeNull();
    });
  });

  describe('warnings', () => {
    it('should warn when "architect" is not set', async () => {
      const project = addProject('lib1', { root: 'projects/lib1' });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The project does not have any targets configured. This might not be an issue. Skipping updating targets.'
      );
    });

    it('should warn when there are no targets', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {},
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The project does not have any targets configured. This might not be an issue. Skipping updating targets.'
      );
    });

    it('should warn when there is no build target', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: { test: { builder: '@angular-devkit/build-angular:karma' } },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'There is no target in the project configuration using the @angular-devkit/build-angular:ng-packagr builder. This might not be an issue. Skipping updating the build configuration.'
      );
    });

    it('should warn when the build target does not have any options and configurations', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          build: { builder: '@angular-devkit/build-angular:ng-packagr' },
        },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The target "build" is not specifying any options or configurations. Skipping updating the target configuration.'
      );
    });

    it('should warn when there is no tsConfig specified in the build target options or development configuration', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: {},
            configurations: { development: {} },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The "build" target does not have the "tsConfig" option configured. Skipping updating the tsConfig file.'
      );
    });

    it('should warn when the specified tsConfig in the build target does not exist', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { tsConfig: 'projects/lib1/tsconfig.lib.json' },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The tsConfig file "projects/lib1/tsconfig.lib.json" specified in the "build" target could not be found. Skipping updating the tsConfig file.'
      );
    });

    it('should warn when there is no project specified in the build target options', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: {},
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The "build" target does not have the "project" option configured. Skipping updating the ng-packagr project file ("ng-package.json").',
      ]);
    });

    it('should warn when the specified project config file in the build target does not exist', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { project: 'projects/lib1/ng-package.json' },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The ng-packagr project file "projects/lib1/ng-package.json" specified in the "build" target could not be found. Skipping updating the ng-packagr project file.',
      ]);
    });

    it('should warn when the lint target does not have any options', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: { lint: { builder: '@angular-eslint/builder:lint' } },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The target "lint" is not specifying any options. Skipping updating the target configuration.',
      ]);
    });

    it('should warn when the specified eslintConfig in the lint target does not exist', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: { eslintConfig: '.non-existent-eslintrc.json' },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The ESLint config file ".non-existent-eslintrc.json" could not be found. Skipping updating the file.',
      ]);
    });

    it('should warn when eslintConfig is not specified and the ".eslintrc.json" file at the project root does not exist', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          lint: { builder: '@angular-eslint/builder:lint', options: {} },
        },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The ESLint config file "projects/lib1/.eslintrc.json" could not be found. Skipping updating the file.',
      ]);
    });

    it('should warn when a specified lint file pattern is not contained within the project', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: { lintFilePatterns: ['not-within-project/**/*.ts'] },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The lint file pattern "not-within-project/**/*.ts" specified in the "lint" target is not contained in the project root or source root. The pattern will not be updated.',
      ]);
    });

    it('should warn when the test target does not have any options', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: { test: { builder: '@angular-devkit/build-angular:karma' } },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The target "test" is not specifying any options. Skipping updating the target configuration.',
      ]);
    });

    it('should warn when there is no tsConfig specified in the test target options', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          test: { builder: '@angular-devkit/build-angular:karma', options: {} },
        },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The "test" target does not have the "tsConfig" option configured. Skipping updating the tsConfig file.',
      ]);
    });

    it('should warn when the specified tsConfig in the test target does not exist', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        architect: {
          test: {
            builder: '@angular-devkit/build-angular:karma',
            options: { tsConfig: 'projects/lib1/tsconfig.spec.json' },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The tsConfig file "projects/lib1/tsconfig.spec.json" specified in the "test" target could not be found. Skipping updating the tsConfig file.'
      );
    });
  });

  describe('files', () => {
    it('should move project files to the right destination', async () => {
      writeJson(tree, 'projects/lib1/ng-package.json', {});
      writeJson(tree, 'projects/lib1/package.json', {});
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(tree.exists('libs/lib1/ng-package.json')).toBe(true);
      expect(tree.exists('libs/lib1/package.json')).toBe(true);
      expect(tree.exists('libs/lib1/README.md')).toBe(true);
      expect(tree.exists('libs/lib1/src/public-api.ts')).toBe(true);
    });
  });

  describe('project configuration', () => {
    it('should convert the project configuration to standalone', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(tree.exists('libs/lib1/project.json')).toBe(true);
      const { projects } = readJson(tree, 'angular.json');
      expect(projects.lib1).toBeUndefined();
    });

    it('should update project root and source root', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { root, sourceRoot } = readProjectConfiguration(tree, 'lib1');
      expect(root).toBe('libs/lib1');
      expect(sourceRoot).toBe('libs/lib1/src');
    });

    it('should set source root when it was not set', async () => {
      const project = addProject('lib1', { root: 'projects/lib1' });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { sourceRoot } = readProjectConfiguration(tree, 'lib1');
      expect(sourceRoot).toBe('libs/lib1/src');
    });

    it('should update build target', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { project: 'projects/lib1/ng-package.json' },
            configurations: {
              production: { tsConfig: 'projects/lib1/tsconfig.lib.prod.json' },
              development: { tsConfig: 'projects/lib1/tsconfig.lib.json' },
            },
            defaultConfiguration: 'production',
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'lib1');
      expect(targets.build).toStrictEqual({
        executor: '@nx/angular:package',
        options: { project: 'libs/lib1/ng-package.json' },
        configurations: {
          production: { tsConfig: 'libs/lib1/tsconfig.lib.prod.json' },
          development: { tsConfig: 'libs/lib1/tsconfig.lib.json' },
        },
        defaultConfiguration: 'production',
      });
    });

    it('should update build target when using a target name different than "build"', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          myCustomBuildTarget: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { project: 'projects/lib1/ng-package.json' },
            configurations: {
              production: { tsConfig: 'projects/lib1/tsconfig.lib.prod.json' },
              development: { tsConfig: 'projects/lib1/tsconfig.lib.json' },
            },
            defaultConfiguration: 'production',
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'lib1');
      expect(targets.myCustomBuildTarget).toStrictEqual({
        executor: '@nx/angular:package',
        options: { project: 'libs/lib1/ng-package.json' },
        configurations: {
          production: { tsConfig: 'libs/lib1/tsconfig.lib.prod.json' },
          development: { tsConfig: 'libs/lib1/tsconfig.lib.json' },
        },
        defaultConfiguration: 'production',
      });
    });

    it('should support a build target with only configurations', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            configurations: {
              production: {
                project: 'projects/lib1/ng-package.json',
                tsConfig: 'projects/lib1/tsconfig.lib.prod.json',
              },
              development: {
                project: 'projects/lib1/ng-package.json',
                tsConfig: 'projects/lib1/tsconfig.lib.json',
              },
            },
            defaultConfiguration: 'production',
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'lib1');
      expect(targets.build).toStrictEqual({
        executor: '@nx/angular:package',
        configurations: {
          production: {
            project: 'libs/lib1/ng-package.json',
            tsConfig: 'libs/lib1/tsconfig.lib.prod.json',
          },
          development: {
            project: 'libs/lib1/ng-package.json',
            tsConfig: 'libs/lib1/tsconfig.lib.json',
          },
        },
        defaultConfiguration: 'production',
      });
    });

    it('should support a build target with no development configuration', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: {
              project: 'projects/lib1/ng-package.json',
              tsConfig: 'projects/lib1/tsconfig.lib.json',
            },
            configurations: {
              production: { tsConfig: 'projects/lib1/tsconfig.lib.prod.json' },
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'lib1');
      expect(targets.build).toStrictEqual({
        executor: '@nx/angular:package',
        options: {
          project: 'libs/lib1/ng-package.json',
          tsConfig: 'libs/lib1/tsconfig.lib.json',
        },
        configurations: {
          production: { tsConfig: 'libs/lib1/tsconfig.lib.prod.json' },
        },
      });
    });

    it('should update lint target', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: [
                'projects/lib1/**/*.ts',
                'projects/lib1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'lib1');
      expect(targets.lint).toStrictEqual({
        executor: '@nx/linter:eslint',
        options: {
          lintFilePatterns: ['libs/lib1/**/*.ts', 'libs/lib1/**/*.html'],
        },
      });
    });

    it('should update lint target when using a name different than "lint"', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          myCustomLintTarget: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: [
                'projects/lib1/**/*.ts',
                'projects/lib1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'lib1');
      expect(targets.myCustomLintTarget).toStrictEqual({
        executor: '@nx/linter:eslint',
        options: {
          lintFilePatterns: ['libs/lib1/**/*.ts', 'libs/lib1/**/*.html'],
        },
      });
    });

    it('should update the eslintConfig option when specified', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              eslintConfig: 'projects/lib1/.eslintrc.json',
              lintFilePatterns: [
                'projects/lib1/**/*.ts',
                'projects/lib1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'lib1');
      expect(targets.lint).toStrictEqual({
        executor: '@nx/linter:eslint',
        options: {
          eslintConfig: 'libs/lib1/.eslintrc.json',
          lintFilePatterns: ['libs/lib1/**/*.ts', 'libs/lib1/**/*.html'],
        },
      });
    });

    it('should set hasTypeAwareRules when there are rules requiring type checking', async () => {
      writeJson(tree, 'projects/lib1/.eslintrc.json', {
        extends: '../../.eslintrc.json',
        ignorePatterns: ['!**/*'],
        overrides: [
          {
            files: ['*.ts', '*.tsx'],
            extends: ['plugin:@nx/typescript'],
            rules: { '@typescript-eslint/await-thenable': 'error' },
          },
        ],
      });
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              eslintConfig: 'projects/lib1/.eslintrc.json',
              lintFilePatterns: [
                'projects/lib1/**/*.ts',
                'projects/lib1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'lib1');
      expect(targets.lint).toStrictEqual({
        executor: '@nx/linter:eslint',
        options: {
          eslintConfig: 'libs/lib1/.eslintrc.json',
          hasTypeAwareRules: true,
          lintFilePatterns: ['libs/lib1/**/*.ts', 'libs/lib1/**/*.html'],
        },
      });
    });

    it('should update test target', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          test: {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'projects/lib1/src/test.ts',
              tsConfig: 'projects/lib1/tsconfig.spec.json',
              karmaConfig: 'projects/lib1/karma.conf.js',
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'lib1');
      expect(targets.test).toStrictEqual({
        executor: '@angular-devkit/build-angular:karma',
        options: {
          main: 'libs/lib1/src/test.ts',
          tsConfig: 'libs/lib1/tsconfig.spec.json',
          karmaConfig: 'libs/lib1/karma.conf.js',
        },
      });
    });

    it('should update test target when using a different name than "test"', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          myCustomTestTarget: {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'projects/lib1/src/test.ts',
              tsConfig: 'projects/lib1/tsconfig.spec.json',
              karmaConfig: 'projects/lib1/karma.conf.js',
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'lib1');
      expect(targets.myCustomTestTarget).toStrictEqual({
        executor: '@angular-devkit/build-angular:karma',
        options: {
          main: 'libs/lib1/src/test.ts',
          tsConfig: 'libs/lib1/tsconfig.spec.json',
          karmaConfig: 'libs/lib1/karma.conf.js',
        },
      });
    });
  });

  describe('ng-package.json', () => {
    it('should update paths in ng-package.json', async () => {
      writeJson(tree, 'projects/parent/lib1/ng-package.json', {
        $schema: '../../../node_modules/ng-packagr/ng-package.schema.json',
        dest: '../../../dist/lib1',
        lib: { entryFile: 'src/public-api.ts' },
      });
      const project = addProject('lib1', {
        root: 'projects/parent/lib1',
        sourceRoot: 'projects/parent/lib1/src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { project: 'projects/parent/lib1/ng-package.json' },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'libs/lib1/ng-package.json')).toStrictEqual({
        $schema: '../../node_modules/ng-packagr/ng-package.schema.json',
        dest: '../../dist/lib1',
        lib: { entryFile: 'src/public-api.ts' },
      });
    });
  });

  describe('tsConfig', () => {
    it('should update tsConfig file specified in the build target options', async () => {
      writeJson(tree, 'projects/lib1/tsconfig.lib.json', {
        extends: '../../tsconfig.json',
        compilerOptions: {
          outDir: '../../out-tsc/lib',
          target: 'es2015',
          declaration: true,
          declarationMap: true,
          inlineSources: true,
          types: [],
          lib: ['dom', 'es2018'],
        },
        exclude: ['src/test.ts', '**/*.spec.ts'],
      });
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { tsConfig: 'projects/lib1/tsconfig.lib.json' },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'libs/lib1/tsconfig.lib.json')).toStrictEqual({
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          target: 'es2015',
          declaration: true,
          declarationMap: true,
          inlineSources: true,
          types: [],
          lib: ['dom', 'es2018'],
        },
        exclude: ['src/test.ts', '**/*.spec.ts'],
        include: ['**/*.ts'],
      });
    });

    it('should not overwrite the include option in the tsConfig file specified in the build target options', async () => {
      writeJson(tree, 'projects/lib1/tsconfig.lib.json', {
        extends: '../../tsconfig.json',
        compilerOptions: {},
        include: ['src/**/*.ts'],
        exclude: ['src/test.ts', '**/*.spec.ts'],
      });
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { tsConfig: 'projects/lib1/tsconfig.lib.json' },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'libs/lib1/tsconfig.lib.json')).toStrictEqual({
        extends: '../../tsconfig.base.json',
        compilerOptions: { outDir: '../../dist/out-tsc' },
        include: ['src/**/*.ts'],
        exclude: ['src/test.ts', '**/*.spec.ts'],
      });
    });

    it('should not set the include option in the tsConfig file specified in the build target options when files is set', async () => {
      writeJson(tree, 'projects/lib1/tsconfig.lib.json', {
        extends: '../../tsconfig.json',
        compilerOptions: {},
        files: ['src/public-api.ts'],
        exclude: ['src/test.ts', '**/*.spec.ts'],
      });
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            options: { tsConfig: 'projects/lib1/tsconfig.lib.json' },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'libs/lib1/tsconfig.lib.json')).toStrictEqual({
        extends: '../../tsconfig.base.json',
        compilerOptions: { outDir: '../../dist/out-tsc' },
        files: ['src/public-api.ts'],
        exclude: ['src/test.ts', '**/*.spec.ts'],
      });
    });

    it('should update tsConfig file specified in the build target development configuration', async () => {
      writeJson(tree, 'projects/lib1/tsconfig.lib.json', {
        extends: '../../tsconfig.json',
        compilerOptions: {
          outDir: '../../out-tsc/lib',
          target: 'es2015',
          declaration: true,
          declarationMap: true,
          inlineSources: true,
          types: [],
          lib: ['dom', 'es2018'],
        },
        exclude: ['src/test.ts', '**/*.spec.ts'],
      });
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
            configurations: {
              development: { tsConfig: 'projects/lib1/tsconfig.lib.json' },
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'libs/lib1/tsconfig.lib.json')).toStrictEqual({
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          target: 'es2015',
          declaration: true,
          declarationMap: true,
          inlineSources: true,
          types: [],
          lib: ['dom', 'es2018'],
        },
        exclude: ['src/test.ts', '**/*.spec.ts'],
        include: ['**/*.ts'],
      });
    });

    it('should update tsConfig file specified in the test target options', async () => {
      writeJson(tree, 'projects/lib1/tsconfig.spec.json', {
        extends: '../../tsconfig.json',
        compilerOptions: {
          outDir: '../../out-tsc/spec',
          types: ['jasmine'],
        },
        files: ['src/test.ts'],
        include: ['**/*.spec.ts', '**/*.d.ts'],
      });
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          test: {
            builder: '@angular-devkit/build-angular:karma',
            options: { tsConfig: 'projects/lib1/tsconfig.spec.json' },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'libs/lib1/tsconfig.spec.json')).toStrictEqual({
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          types: ['jasmine'],
        },
        files: ['src/test.ts'],
        include: ['**/*.spec.ts', '**/*.d.ts'],
      });
    });
  });

  describe('eslint', () => {
    it('should update the extends path correctly', async () => {
      writeJson(tree, 'projects/parent/lib1/.eslintrc.json', {
        extends: '../../../.eslintrc.json',
      });
      const project = addProject('lib1', {
        root: 'projects/parent/lib1',
        sourceRoot: 'projects/parent/lib1/src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: [
                'projects/parent/lib1/**/*.ts',
                'projects/parent/lib1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'libs/lib1/.eslintrc.json').extends).toBe(
        '../../.eslintrc.json'
      );
    });

    it('should set the extends paths to extend from the root config when is not set', async () => {
      writeJson(tree, 'projects/lib1/.eslintrc.json', {});
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: [
                'projects/lib1/**/*.ts',
                'projects/lib1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'libs/lib1/.eslintrc.json').extends).toBe(
        '../../.eslintrc.json'
      );
    });

    it('should update the extends paths correctly when is an array', async () => {
      writeJson(tree, 'projects/parent/lib1/.eslintrc.json', {
        extends: ['../../../.eslintrc.json'],
      });
      const project = addProject('lib1', {
        root: 'projects/parent/lib1',
        sourceRoot: 'projects/parent/lib1/src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: [
                'projects/parent/lib1/**/*.ts',
                'projects/parent/lib1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'libs/lib1/.eslintrc.json').extends).toStrictEqual([
        '../../.eslintrc.json',
      ]);
    });

    it('should update the extends paths to extend from root when is an array and is not extending from root', async () => {
      writeJson(tree, 'projects/parent/lib1/.eslintrc.json', {
        extends: ['./.eslintrc.json'],
      });
      const project = addProject('lib1', {
        root: 'projects/parent/lib1',
        sourceRoot: 'projects/parent/lib1/src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: [
                'projects/parent/lib1/**/*.ts',
                'projects/parent/lib1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'libs/lib1/.eslintrc.json').extends).toStrictEqual([
        '../../.eslintrc.json',
        './.eslintrc.json',
      ]);
    });

    it('should update parserOptions project files', async () => {
      writeJson(tree, 'projects/lib1/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            parserOptions: {
              project: [
                'projects/lib1/tsconfig.lib.json',
                'projects/lib1/tsconfig.spec.json',
              ],
              createDefaultProgram: true,
            },
          },
        ],
      });
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: [
                'projects/lib1/**/*.ts',
                'projects/lib1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'libs/lib1/.eslintrc.json')).toStrictEqual({
        extends: '../../.eslintrc.json',
        ignorePatterns: ['!**/*'],
        overrides: [
          {
            files: ['*.ts'],
            parserOptions: {
              project: ['libs/lib1/tsconfig.*?.json'],
              createDefaultProgram: true,
            },
          },
        ],
      });
    });
  });

  describe('cacheable operations', () => {
    it('should add custom target names to the cacheable operations', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          myCustomBuild: {
            builder: '@angular-devkit/build-angular:ng-packagr',
          },
          myCustomLint: { builder: '@angular-eslint/builder:lint' },
          myCustomTest: { builder: '@angular-devkit/build-angular:karma' },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { tasksRunnerOptions } = readNxJson(tree);
      expect(
        tasksRunnerOptions.default.options.cacheableOperations
      ).toStrictEqual([
        'build',
        'lint',
        'test',
        'e2e',
        'myCustomBuild',
        'myCustomTest',
        'myCustomLint',
      ]);
    });

    it('should not duplicate cacheable operations', async () => {
      const project = addProject('lib1', {
        root: 'projects/lib1',
        sourceRoot: 'projects/lib1/src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:ng-packagr',
          },
          lint: { builder: '@angular-eslint/builder:lint' },
          myCustomTest: { builder: '@angular-devkit/build-angular:karma' },
        },
      });
      const migrator = new LibMigrator(tree, {}, project);

      await migrator.migrate();

      const { tasksRunnerOptions } = readNxJson(tree);
      expect(
        tasksRunnerOptions.default.options.cacheableOperations
      ).toStrictEqual(['build', 'lint', 'test', 'e2e', 'myCustomTest']);
    });
  });
});
