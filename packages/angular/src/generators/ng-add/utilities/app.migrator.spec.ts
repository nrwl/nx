import {
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  TargetConfiguration,
  Tree,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { AppMigrator } from './app.migrator';
import { MigrationProjectConfiguration } from './types';

type AngularCliProjectConfiguration = Omit<ProjectConfiguration, 'targets'> & {
  architect?: {
    [targetName: string]: Omit<TargetConfiguration, 'executor'> & {
      builder: string;
    };
  };
};

const mockedLogger = { warn: jest.fn() };

describe('app migrator', () => {
  let tree: Tree;

  function addProject(
    name: string,
    config: AngularCliProjectConfiguration
  ): MigrationProjectConfiguration {
    config.projectType = 'application';
    const angularJson = readJson(tree, 'angular.json');
    angularJson.projects[name] = config;
    writeJson(tree, 'angular.json', angularJson);
    tree.write(`${config.root}/README.md`, '');
    tree.write(`${config.sourceRoot}/main.ts`, '');

    return { config: readProjectConfiguration(tree, name), name };
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    // when this migrator is invoked, some of the workspace migration has
    // already been run, so we make some adjustments to match that state
    tree.delete('workspace.json');
    writeJson(tree, 'angular.json', { version: 2, projects: {} });

    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('should fail validation when the project root is not specified', async () => {
      const project = addProject('app1', {} as any);
      const migrator = new AppMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The project root is not defined in the project configuration.'
      );
      expect(result[0].hint).toBe(
        'Make sure the value for "projects.app1.root" is set or remove the project if it is not valid.'
      );
    });

    it('should fail validation when the project root is not valid', async () => {
      const project = addProject('app1', { root: '' });
      const migrator = new AppMigrator(
        tree,
        {},
        {
          ...project,
          config: { ...project.config, root: 'wrong-root' },
        }
      );

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The project root "wrong-root" could not be found.'
      );
      expect(result[0].hint).toBe(
        'Make sure the value for "projects.app1.root" is correct or remove the project if it is not valid.'
      );
    });

    it('should fail validation when the project source root is specified and it is not valid', async () => {
      const project = addProject('app1', { root: '', sourceRoot: 'src' });
      const migrator = new AppMigrator(
        tree,
        {},
        {
          ...project,
          config: { ...project.config, sourceRoot: 'wrong-src' },
        }
      );

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The project source root "wrong-src" could not be found.'
      );
      expect(result[0].hint).toBe(
        'Make sure the value for "projects.app1.sourceRoot" is correct or remove the project if it is not valid.'
      );
    });

    it('should fail validation when the project is using unsupported builders', async () => {
      const project = addProject('app1', {
        root: '',
        architect: { build: { builder: '@not/supported:builder' } },
      });
      const migrator = new AppMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].messageGroup.title).toBe('Unsupported builders');
      expect(result[0].messageGroup.messages).toStrictEqual([
        'The "build" target is using an unsupported builder "@not/supported:builder".',
      ]);
      expect(result[0].hint).toBe(
        'The supported builders for applications are: "@angular-devkit/build-angular:browser", "@angular-devkit/build-angular:protractor", "@cypress/schematic:cypress", "@angular-devkit/build-angular:extract-i18n", "@angular-eslint/builder:lint", "@nguniversal/builders:prerender", "@angular-devkit/build-angular:dev-server", "@angular-devkit/build-angular:server", "@nguniversal/builders:ssr-dev-server" and "@angular-devkit/build-angular:karma".'
      );
    });

    it('should fail validation with an error message per target using an unsupported builder', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          build: { builder: '@not/supported:builder' },
          test: { builder: '@other/not-supported:builder' },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].messageGroup.title).toBe('Unsupported builders');
      expect(result[0].messageGroup.messages).toStrictEqual([
        'The "build" target is using an unsupported builder "@not/supported:builder".',
        'The "test" target is using an unsupported builder "@other/not-supported:builder".',
      ]);
      expect(result[0].hint).toBe(
        'The supported builders for applications are: "@angular-devkit/build-angular:browser", "@angular-devkit/build-angular:protractor", "@cypress/schematic:cypress", "@angular-devkit/build-angular:extract-i18n", "@angular-eslint/builder:lint", "@nguniversal/builders:prerender", "@angular-devkit/build-angular:dev-server", "@angular-devkit/build-angular:server", "@nguniversal/builders:ssr-dev-server" and "@angular-devkit/build-angular:karma".'
      );
    });

    it('should still fail validation when the target name is not a common one', async () => {
      const project = addProject('app1', {
        root: '',
        architect: { 'my-build': { builder: '@not/supported:builder' } },
      });
      const migrator = new AppMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].messageGroup.title).toBe('Unsupported builders');
      expect(result[0].messageGroup.messages).toStrictEqual([
        'The "my-build" target is using an unsupported builder "@not/supported:builder".',
      ]);
      expect(result[0].hint).toBe(
        'The supported builders for applications are: "@angular-devkit/build-angular:browser", "@angular-devkit/build-angular:protractor", "@cypress/schematic:cypress", "@angular-devkit/build-angular:extract-i18n", "@angular-eslint/builder:lint", "@nguniversal/builders:prerender", "@angular-devkit/build-angular:dev-server", "@angular-devkit/build-angular:server", "@nguniversal/builders:ssr-dev-server" and "@angular-devkit/build-angular:karma".'
      );
    });

    it('should fail validation when there are multiple targets for the same builder', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          build1: { builder: '@angular-devkit/build-angular:browser' },
          build2: { builder: '@angular-devkit/build-angular:browser' },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'There is more than one target using a builder that is used to build the project ("build1" and "build2").'
      );
      expect(result[0].hint).toBe(
        'Make sure the project only has one target with a builder that is used to build the project.'
      );
    });

    it('should fail validation with multiple errors when there are multiple targets for the same builders', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          build1: { builder: '@angular-devkit/build-angular:browser' },
          build2: { builder: '@angular-devkit/build-angular:browser' },
          lint1: { builder: '@angular-eslint/builder:lint' },
          lint2: { builder: '@angular-eslint/builder:lint' },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toHaveLength(2);
      expect(result[0].message).toBe(
        'There is more than one target using a builder that is used to build the project ("build1" and "build2").'
      );
      expect(result[0].hint).toBe(
        'Make sure the project only has one target with a builder that is used to build the project.'
      );
      expect(result[1].message).toBe(
        'There is more than one target using a builder that is used to lint the project ("lint1" and "lint2").'
      );
      expect(result[1].hint).toBe(
        'Make sure the project only has one target with a builder that is used to lint the project.'
      );
    });

    it('should succeed validation', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          build: { builder: '@angular-devkit/build-angular:browser' },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      const result = migrator.validate();

      expect(result).toBeNull();
    });
  });

  describe('warnings', () => {
    it('should warn when "architect" is not set', async () => {
      const project = addProject('app1', { root: '' });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The project does not have any targets configured. Skipping updating targets.'
      );
    });

    it('should warn when there are no targets', async () => {
      const project = addProject('app1', { root: '', architect: {} });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The project does not have any targets configured. Skipping updating targets.'
      );
    });

    it('should warn when there is no build target', async () => {
      const project = addProject('app1', {
        root: '',
        architect: { test: { builder: '@angular-devkit/build-angular:karma' } },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'There is no build target in the project configuration. Skipping updating the build target configuration.'
      );
    });

    it('should warn when the build target does not have any options and configurations', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          build: { builder: '@angular-devkit/build-angular:browser' },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The target "build" is not specifying any options or configurations. Skipping updating the target configuration.'
      );
    });

    it('should warn when there is no tsConfig specified in the build target options or development configuration', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: {},
            configurations: { development: {} },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The "build" target does not have the "tsConfig" option configured. Skipping updating the tsConfig file.'
      );
    });

    it('should warn when the specified tsConfig in the build target does not exist', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: { tsConfig: 'tsconfig.app.json' },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The tsConfig file "tsconfig.app.json" specified in the "build" target could not be found. Skipping updating the tsConfig file.'
      );
    });

    it('should warn when the lint target does not have any options', async () => {
      const project = addProject('app1', {
        root: '',
        architect: { lint: { builder: '@angular-eslint/builder:lint' } },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The target "lint" is not specifying any options. Skipping updating the target configuration.',
      ]);
    });

    it('should warn when the specified eslintConfig in the lint target does not exist', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: { eslintConfig: '.non-existent-eslintrc.json' },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The ESLint config file ".non-existent-eslintrc.json" could not be found. Skipping updating the file.',
      ]);
    });

    it('should warn when eslintConfig is not specified and the ".eslintrc.json" file at the project root does not exist', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          lint: { builder: '@angular-eslint/builder:lint', options: {} },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The ESLint config file ".eslintrc.json" could not be found. Skipping updating the file.',
      ]);
    });

    it('should warn when a specified lint file pattern is not contained within the project', async () => {
      const project = addProject('app1', {
        root: 'projects/app1',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: { lintFilePatterns: ['not-within-project/**/*.ts'] },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The lint file pattern "not-within-project/**/*.ts" specified in the "lint" target is not contained in the project root or source root. The pattern will not be updated.',
      ]);
    });

    it('should warn when the server target does not have any options and configurations', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          server: { builder: '@angular-devkit/build-angular:server' },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The target "server" is not specifying any options or configurations. Skipping updating the target configuration.'
      );
    });

    it('should warn when there is no tsConfig specified in the server target options or development configuration', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          server: {
            builder: '@angular-devkit/build-angular:server',
            options: {},
            configurations: { development: {} },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The "server" target does not have the "tsConfig" option configured. Skipping updating the tsConfig file.'
      );
    });

    it('should warn when the specified tsConfig in the server target does not exist', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          server: {
            builder: '@angular-devkit/build-angular:server',
            options: { tsConfig: 'tsconfig.server.json' },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The tsConfig file "tsconfig.server.json" specified in the "server" target could not be found. Skipping updating the tsConfig file.'
      );
    });

    it('should warn when the test target does not have any options', async () => {
      const project = addProject('app1', {
        root: '',
        architect: { test: { builder: '@angular-devkit/build-angular:karma' } },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The target "test" is not specifying any options. Skipping updating the target configuration.',
      ]);
    });

    it('should warn when there is no tsConfig specified in the test target options', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          test: { builder: '@angular-devkit/build-angular:karma', options: {} },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn.mock.calls).toContainEqual([
        'The "test" target does not have the "tsConfig" option configured. Skipping updating the tsConfig file.',
      ]);
    });

    it('should warn when the specified tsConfig in the test target does not exist', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          test: {
            builder: '@angular-devkit/build-angular:karma',
            options: { tsConfig: 'tsconfig.spec.json' },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The tsConfig file "tsconfig.spec.json" specified in the "test" target could not be found. Skipping updating the tsConfig file.'
      );
    });

    it('should warn when the prerender target does not have any options', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          prerender: { builder: '@nguniversal/builders:prerender' },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The target "prerender" is not specifying any options. Skipping updating the target configuration.'
      );
    });

    it('should warn when the serveSsr target does not have any options and configurations', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          'serve-ssr': { builder: '@nguniversal/builders:ssr-dev-server' },
        },
      });
      const migrator = new AppMigrator(tree, {}, project, mockedLogger as any);

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'The target "serve-ssr" is not specifying any options or configurations. Skipping updating the target configuration.'
      );
    });
  });

  describe('files', () => {
    it('should move project files to the right destination when the app is at the workspace root', async () => {
      tree.write('.browserslistrc', '');
      writeJson(tree, '.eslintrc.json', {});
      writeJson(tree, 'tsconfig.app.json', {});
      writeJson(tree, 'tsconfig.spec.json', {});
      tree.write('src/app/app.module.ts', '// content');
      writeJson(tree, 'e2e/tsconfig.json', {});
      tree.write('e2e/protractor.conf.js', '// content');
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: { tsConfig: 'tsconfig.app.json' },
          },
          test: {
            builder: '@angular-devkit/build-angular:karma',
            options: { tsConfig: 'tsconfig.spec.json' },
          },
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {},
          },
          e2e: {
            builder: '@angular-devkit/build-angular:protractor',
            options: { protractorConfig: 'e2e/protractor.conf.json' },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(tree.exists('apps/app1/.browserslistrc')).toBe(true);
      expect(tree.exists('apps/app1/.eslintrc.json')).toBe(true);
      expect(tree.exists('apps/app1/tsconfig.app.json')).toBe(true);
      expect(tree.exists('apps/app1/tsconfig.spec.json')).toBe(true);
      expect(tree.exists('apps/app1/src/app/app.module.ts')).toBe(true);
      expect(tree.exists('apps/app1-e2e/tsconfig.json')).toBe(true);
      expect(tree.exists('apps/app1-e2e/protractor.conf.js')).toBe(true);
    });

    it('should move project files to the right destination when the app is at the projects folder', async () => {
      tree.write('projects/app1/.browserslistrc', '');
      writeJson(tree, 'projects/app1/.eslintrc.json', {});
      writeJson(tree, 'projects/app1/tsconfig.app.json', {});
      writeJson(tree, 'projects/app1/tsconfig.spec.json', {});
      tree.write('projects/app1/src/app/app.module.ts', '// content');
      writeJson(tree, 'projects/app1/e2e/tsconfig.json', {});
      tree.write('projects/app1/e2e/protractor.conf.js', '// content');
      const project = addProject('app1', {
        root: 'projects/app1',
        sourceRoot: 'projects/app1/src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: { tsConfig: 'projects/app1/tsconfig.app.json' },
          },
          test: {
            builder: '@angular-devkit/build-angular:karma',
            options: { tsConfig: 'projects/app1/tsconfig.spec.json' },
          },
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {},
          },
          e2e: {
            builder: '@angular-devkit/build-angular:protractor',
            options: {
              protractorConfig: 'projects/app1/e2e/protractor.conf.json',
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(tree.exists('apps/app1/.browserslistrc')).toBe(true);
      expect(tree.exists('apps/app1/.eslintrc.json')).toBe(true);
      expect(tree.exists('apps/app1/tsconfig.app.json')).toBe(true);
      expect(tree.exists('apps/app1/tsconfig.spec.json')).toBe(true);
      expect(tree.exists('apps/app1/src/app/app.module.ts')).toBe(true);
      expect(tree.exists('apps/app1-e2e/tsconfig.json')).toBe(true);
      expect(tree.exists('apps/app1-e2e/protractor.conf.js')).toBe(true);
    });
  });

  describe('project configuration', () => {
    it('should convert the project configuration to standalone', async () => {
      const project = addProject('app1', { root: '', sourceRoot: 'src' });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(tree.exists('apps/app1/project.json')).toBe(true);
      const { projects } = readJson(tree, 'angular.json');
      expect(projects.app1).toBe('apps/app1');
    });

    it('should update project root and source root', async () => {
      const project = addProject('app1', { root: '', sourceRoot: 'src' });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { root, sourceRoot } = readProjectConfiguration(tree, 'app1');
      expect(root).toBe('apps/app1');
      expect(sourceRoot).toBe('apps/app1/src');
    });

    it('should set source root when it was not set', async () => {
      const project = addProject('app1', { root: '' });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { sourceRoot } = readProjectConfiguration(tree, 'app1');
      expect(sourceRoot).toBe('apps/app1/src');
    });

    it('should update build target', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: {
              outputPath: 'dist/app1',
              index: 'src/index.html',
              main: 'src/main.ts',
              polyfills: 'src/polyfills.ts',
              tsConfig: 'tsconfig.app.json',
              assets: ['src/favicon.ico', 'src/assets'],
              styles: ['src/styles.css'],
              scripts: [],
            },
            configurations: {
              production: {
                fileReplacements: [
                  {
                    replace: 'src/environments/environment.ts',
                    with: 'src/environments/environment.prod.ts',
                  },
                ],
              },
              development: {},
            },
            defaultConfiguration: 'production',
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.build).toStrictEqual({
        executor: '@angular-devkit/build-angular:browser',
        options: {
          outputPath: 'dist/apps/app1',
          index: 'apps/app1/src/index.html',
          main: 'apps/app1/src/main.ts',
          polyfills: 'apps/app1/src/polyfills.ts',
          tsConfig: 'apps/app1/tsconfig.app.json',
          assets: ['apps/app1/src/favicon.ico', 'apps/app1/src/assets'],
          styles: ['apps/app1/src/styles.css'],
          scripts: [],
        },
        configurations: {
          production: {
            fileReplacements: [
              {
                replace: 'apps/app1/src/environments/environment.ts',
                with: 'apps/app1/src/environments/environment.prod.ts',
              },
            ],
          },
          development: {},
        },
        defaultConfiguration: 'production',
      });
    });

    it('should update build target when using a target name different than "build"', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          myCustomBuildTarget: {
            builder: '@angular-devkit/build-angular:browser',
            options: {
              outputPath: 'dist/app1',
              index: 'src/index.html',
              main: 'src/main.ts',
              polyfills: 'src/polyfills.ts',
              tsConfig: 'tsconfig.app.json',
              assets: ['src/favicon.ico', 'src/assets'],
              styles: ['src/styles.css'],
              scripts: [],
            },
            configurations: {
              production: {
                fileReplacements: [
                  {
                    replace: 'src/environments/environment.ts',
                    with: 'src/environments/environment.prod.ts',
                  },
                ],
              },
              development: {},
            },
            defaultConfiguration: 'production',
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.myCustomBuildTarget).toStrictEqual({
        executor: '@angular-devkit/build-angular:browser',
        options: {
          outputPath: 'dist/apps/app1',
          index: 'apps/app1/src/index.html',
          main: 'apps/app1/src/main.ts',
          polyfills: 'apps/app1/src/polyfills.ts',
          tsConfig: 'apps/app1/tsconfig.app.json',
          assets: ['apps/app1/src/favicon.ico', 'apps/app1/src/assets'],
          styles: ['apps/app1/src/styles.css'],
          scripts: [],
        },
        configurations: {
          production: {
            fileReplacements: [
              {
                replace: 'apps/app1/src/environments/environment.ts',
                with: 'apps/app1/src/environments/environment.prod.ts',
              },
            ],
          },
          development: {},
        },
        defaultConfiguration: 'production',
      });
    });

    it('should update the outputPath option of the build target with a "browser" segment at the end when there is a server target', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: { outputPath: 'dist/app1' },
          },
          server: { builder: '@angular-devkit/build-angular:server' },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.build).toStrictEqual({
        executor: '@angular-devkit/build-angular:browser',
        options: { outputPath: 'dist/apps/app1/browser' },
      });
    });

    it('should update lint target', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: ['src/**/*.ts', 'src/**/*.html'],
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.lint).toStrictEqual({
        executor: '@nrwl/linter:eslint',
        options: {
          lintFilePatterns: ['apps/app1/**/*.ts', 'apps/app1/**/*.html'],
        },
      });
    });

    it('should update lint target when using a name different than "lint"', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          myCustomLintTarget: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: ['src/**/*.ts', 'src/**/*.html'],
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.myCustomLintTarget).toStrictEqual({
        executor: '@nrwl/linter:eslint',
        options: {
          lintFilePatterns: ['apps/app1/**/*.ts', 'apps/app1/**/*.html'],
        },
      });
    });

    it('should update the eslintConfig option when specified', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              eslintConfig: '.eslintrc.json',
              lintFilePatterns: ['src/**/*.ts', 'src/**/*.html'],
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.lint).toStrictEqual({
        executor: '@nrwl/linter:eslint',
        options: {
          eslintConfig: 'apps/app1/.eslintrc.json',
          lintFilePatterns: ['apps/app1/**/*.ts', 'apps/app1/**/*.html'],
        },
      });
    });

    it('should set hasTypeAwareRules when there are rules requiring type checking', async () => {
      writeJson(tree, '.eslintrc.json', {
        root: true,
        ignorePatterns: ['projects/**/*'],
        overrides: [
          {
            files: ['*.ts', '*.tsx'],
            extends: ['plugin:@nrwl/nx/typescript'],
            rules: { '@typescript-eslint/await-thenable': 'error' },
          },
        ],
      });
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              eslintConfig: '.eslintrc.json',
              lintFilePatterns: ['src/**/*.ts', 'src/**/*.html'],
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.lint).toStrictEqual({
        executor: '@nrwl/linter:eslint',
        options: {
          eslintConfig: 'apps/app1/.eslintrc.json',
          hasTypeAwareRules: true,
          lintFilePatterns: ['apps/app1/**/*.ts', 'apps/app1/**/*.html'],
        },
      });
    });

    it('should update server target', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          server: {
            builder: '@angular-devkit/build-angular:server',
            options: {
              outputPath: 'dist/app1/server',
              main: 'server.ts',
              tsConfig: 'tsconfig.server.json',
            },
            configurations: {
              production: {
                outputHashing: 'media',
                fileReplacements: [
                  {
                    replace: 'src/environments/environment.ts',
                    with: 'src/environments/environment.prod.ts',
                  },
                ],
              },
              development: {},
            },
            defaultConfiguration: 'production',
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.server).toStrictEqual({
        executor: '@angular-devkit/build-angular:server',
        options: {
          outputPath: 'dist/apps/app1/server',
          main: 'apps/app1/server.ts',
          tsConfig: 'apps/app1/tsconfig.server.json',
        },
        configurations: {
          production: {
            outputHashing: 'media',
            fileReplacements: [
              {
                replace: 'apps/app1/src/environments/environment.ts',
                with: 'apps/app1/src/environments/environment.prod.ts',
              },
            ],
          },
          development: {},
        },
        defaultConfiguration: 'production',
      });
    });

    it('should update server target when using a target name different than "server"', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          myCustomServerTarget: {
            builder: '@angular-devkit/build-angular:server',
            options: {
              outputPath: 'dist/app1/server',
              main: 'server.ts',
              tsConfig: 'tsconfig.server.json',
            },
            configurations: {
              production: {
                outputHashing: 'media',
                fileReplacements: [
                  {
                    replace: 'src/environments/environment.ts',
                    with: 'src/environments/environment.prod.ts',
                  },
                ],
              },
              development: {},
            },
            defaultConfiguration: 'production',
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.myCustomServerTarget).toStrictEqual({
        executor: '@angular-devkit/build-angular:server',
        options: {
          outputPath: 'dist/apps/app1/server',
          main: 'apps/app1/server.ts',
          tsConfig: 'apps/app1/tsconfig.server.json',
        },
        configurations: {
          production: {
            outputHashing: 'media',
            fileReplacements: [
              {
                replace: 'apps/app1/src/environments/environment.ts',
                with: 'apps/app1/src/environments/environment.prod.ts',
              },
            ],
          },
          development: {},
        },
        defaultConfiguration: 'production',
      });
    });

    it('should update test target', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          test: {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'src/test.ts',
              tsConfig: 'tsconfig.spec.json',
              karmaConfig: 'karma.conf.js',
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.test).toStrictEqual({
        executor: '@angular-devkit/build-angular:karma',
        options: {
          main: 'apps/app1/src/test.ts',
          tsConfig: 'apps/app1/tsconfig.spec.json',
          karmaConfig: 'apps/app1/karma.conf.js',
        },
      });
    });

    it('should update test target when using a different name than "test"', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          myCustomTestTarget: {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'src/test.ts',
              tsConfig: 'tsconfig.spec.json',
              karmaConfig: 'karma.conf.js',
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.myCustomTestTarget).toStrictEqual({
        executor: '@angular-devkit/build-angular:karma',
        options: {
          main: 'apps/app1/src/test.ts',
          tsConfig: 'apps/app1/tsconfig.spec.json',
          karmaConfig: 'apps/app1/karma.conf.js',
        },
      });
    });

    it('should update prerender target', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          prerender: {
            builder: '@nguniversal/builders:prerender',
            options: { routesFile: './server-routes-files.txt' },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.prerender).toStrictEqual({
        executor: '@nguniversal/builders:prerender',
        options: { routesFile: 'apps/app1/server-routes-files.txt' },
      });
    });

    it('should update prerender target when using a different name than "prerender"', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          myCustomPrerenderTarget: {
            builder: '@nguniversal/builders:prerender',
            options: { routesFile: './server-routes-files.txt' },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.myCustomPrerenderTarget).toStrictEqual({
        executor: '@nguniversal/builders:prerender',
        options: { routesFile: 'apps/app1/server-routes-files.txt' },
      });
    });

    it('should update serve-ssr target', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          'serve-ssr': {
            builder: '@nguniversal/builders:ssr-dev-server',
            options: {
              sslKey: './ssl/ssl.key',
              sslCert: './ssl/ssl.cert',
              proxyConfig: './proxy.conf.js',
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets['serve-ssr']).toStrictEqual({
        executor: '@nguniversal/builders:ssr-dev-server',
        options: {
          sslKey: 'apps/app1/ssl/ssl.key',
          sslCert: 'apps/app1/ssl/ssl.cert',
          proxyConfig: 'apps/app1/proxy.conf.js',
        },
      });
    });

    it('should update serve-ssr target when using a different name than "serve-ssr"', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          myCustomServeSsr: {
            builder: '@nguniversal/builders:ssr-dev-server',
            options: {
              sslKey: './ssl/ssl.key',
              sslCert: './ssl/ssl.cert',
              proxyConfig: './proxy.conf.js',
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { targets } = readProjectConfiguration(tree, 'app1');
      expect(targets.myCustomServeSsr).toStrictEqual({
        executor: '@nguniversal/builders:ssr-dev-server',
        options: {
          sslKey: 'apps/app1/ssl/ssl.key',
          sslCert: 'apps/app1/ssl/ssl.cert',
          proxyConfig: 'apps/app1/proxy.conf.js',
        },
      });
    });
  });

  describe('tsConfig', () => {
    it('should update tsConfig file specified in the build target options', async () => {
      writeJson(tree, 'tsconfig.app.json', {
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: './out-tsc/app',
          types: [],
        },
        files: ['src/main.ts', 'src/polyfills.ts'],
        include: ['src/**/*.d.ts'],
      });
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: { tsConfig: 'tsconfig.app.json' },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'apps/app1/tsconfig.app.json')).toStrictEqual({
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          types: [],
        },
        files: ['src/main.ts', 'src/polyfills.ts'],
        include: ['src/**/*.d.ts'],
      });
    });

    it('should update tsConfig file specified in the build target development configuration', async () => {
      writeJson(tree, 'tsconfig.app.json', {
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: './out-tsc/app',
          types: [],
        },
        files: ['src/main.ts', 'src/polyfills.ts'],
        include: ['src/**/*.d.ts'],
      });
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            configurations: {
              development: { tsConfig: 'tsconfig.app.json' },
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'apps/app1/tsconfig.app.json')).toStrictEqual({
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          types: [],
        },
        files: ['src/main.ts', 'src/polyfills.ts'],
        include: ['src/**/*.d.ts'],
      });
    });

    it('should update tsConfig file specified in the test target options', async () => {
      writeJson(tree, 'tsconfig.spec.json', {
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: './out-tsc/spec',
          types: ['jasmine'],
        },
        files: ['src/test.ts', 'src/polyfills.ts'],
        include: ['src/**/*.spec.ts', 'src/**/*.d.ts'],
      });
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          test: {
            builder: '@angular-devkit/build-angular:karma',
            options: { tsConfig: 'tsconfig.spec.json' },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'apps/app1/tsconfig.spec.json')).toStrictEqual({
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          types: ['jasmine'],
        },
        files: ['src/test.ts', 'src/polyfills.ts'],
        include: ['src/**/*.spec.ts', 'src/**/*.d.ts'],
      });
    });

    it('should update tsConfig file specified in the server target options', async () => {
      writeJson(tree, 'tsconfig.server.json', {
        extends: './tsconfig.app.json',
        compilerOptions: {
          outDir: './out-tsc/server',
          target: 'es2019',
          types: ['node'],
        },
        files: ['src/main.server.ts', 'server.ts'],
        angularCompilerOptions: {
          entryModule: './src/app/app.server.module#AppServerModule',
        },
      });
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          server: {
            builder: '@angular-devkit/build-angular:server',
            options: { tsConfig: 'tsconfig.server.json' },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'apps/app1/tsconfig.server.json')).toStrictEqual({
        extends: './tsconfig.app.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          target: 'es2019',
          types: ['node'],
        },
        files: ['src/main.server.ts', 'server.ts'],
        angularCompilerOptions: {
          entryModule: './src/app/app.server.module#AppServerModule',
        },
      });
    });

    it('should update tsConfig file specified in the build target development configuration', async () => {
      writeJson(tree, 'tsconfig.server.json', {
        extends: './tsconfig.app.json',
        compilerOptions: {
          outDir: './out-tsc/server',
          target: 'es2019',
          types: ['node'],
        },
        files: ['src/main.server.ts', 'server.ts'],
        angularCompilerOptions: {
          entryModule: './src/app/app.server.module#AppServerModule',
        },
      });
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          server: {
            builder: '@angular-devkit/build-angular:server',
            configurations: {
              development: { tsConfig: 'tsconfig.server.json' },
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'apps/app1/tsconfig.server.json')).toStrictEqual({
        extends: './tsconfig.app.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          target: 'es2019',
          types: ['node'],
        },
        files: ['src/main.server.ts', 'server.ts'],
        angularCompilerOptions: {
          entryModule: './src/app/app.server.module#AppServerModule',
        },
      });
    });
  });

  describe('eslint', () => {
    it('should update the extends path correctly', async () => {
      writeJson(tree, 'projects/parent/app1/.eslintrc.json', {
        extends: '../../../.eslintrc.json',
      });
      const project = addProject('app1', {
        root: 'projects/parent/app1',
        sourceRoot: 'projects/parent/app1/src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: [
                'projects/parent/app1/**/*.ts',
                'projects/parent/app1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'apps/app1/.eslintrc.json').extends).toBe(
        '../../.eslintrc.json'
      );
    });

    it('should set the extends paths to extend from the root config when is not set', async () => {
      writeJson(tree, '.eslintrc.json', {});
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: ['src/**/*.ts', 'src/**/*.html'],
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'apps/app1/.eslintrc.json').extends).toBe(
        '../../.eslintrc.json'
      );
    });

    it('should update the extends paths correctly when is an array', async () => {
      writeJson(tree, 'projects/parent/app1/.eslintrc.json', {
        extends: ['../../../.eslintrc.json'],
      });
      const project = addProject('app1', {
        root: 'projects/parent/app1',
        sourceRoot: 'projects/parent/app1/src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: [
                'projects/parent/app1/**/*.ts',
                'projects/parent/app1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'apps/app1/.eslintrc.json').extends).toStrictEqual([
        '../../.eslintrc.json',
      ]);
    });

    it('should update the extends paths to extend from root when is an array and is not extending from root', async () => {
      writeJson(tree, 'projects/parent/app1/.eslintrc.json', {
        extends: ['./.eslintrc.json'],
      });
      const project = addProject('app1', {
        root: 'projects/parent/app1',
        sourceRoot: 'projects/parent/app1/src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: [
                'projects/parent/app1/**/*.ts',
                'projects/parent/app1/**/*.html',
              ],
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'apps/app1/.eslintrc.json').extends).toStrictEqual([
        '../../.eslintrc.json',
        './.eslintrc.json',
      ]);
    });

    it('should update parserOptions project files', async () => {
      writeJson(tree, '.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            parserOptions: {
              project: ['tsconfig.app.json', 'tsconfig.spec.json'],
              createDefaultProgram: true,
            },
          },
        ],
      });
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          lint: {
            builder: '@angular-eslint/builder:lint',
            options: {
              lintFilePatterns: ['src/**/*.ts', 'src/**/*.html'],
            },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      expect(readJson(tree, 'apps/app1/.eslintrc.json')).toStrictEqual({
        extends: '../../.eslintrc.json',
        ignorePatterns: ['!**/*'],
        overrides: [
          {
            files: ['*.ts'],
            parserOptions: {
              project: ['apps/app1/tsconfig.*?.json'],
              createDefaultProgram: true,
            },
          },
        ],
      });
    });
  });

  describe('cacheable operations', () => {
    it('should add custom target names to the cacheable operations', async () => {
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          myCustomBuild: {
            builder: '@angular-devkit/build-angular:browser',
          },
          myCustomLint: { builder: '@angular-eslint/builder:lint' },
          myCustomTest: { builder: '@angular-devkit/build-angular:karma' },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { tasksRunnerOptions } = readWorkspaceConfiguration(tree);
      expect(
        tasksRunnerOptions.default.options.cacheableOperations
      ).toStrictEqual([
        'build',
        'lint',
        'test',
        'e2e',
        'myCustomBuild',
        'myCustomLint',
        'myCustomTest',
      ]);
    });

    it('should not duplicate cacheable operations', async () => {
      tree.write('protractor.conf.js', '');
      writeJson(tree, 'e2e/tsconfig.json', {});
      const project = addProject('app1', {
        root: '',
        sourceRoot: 'src',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
          },
          lint: { builder: '@angular-eslint/builder:lint' },
          myCustomTest: { builder: '@angular-devkit/build-angular:karma' },
          e2e: {
            builder: '@angular-devkit/build-angular:protractor',
            options: { protractorConfig: 'protractor.conf.js' },
          },
        },
      });
      const migrator = new AppMigrator(tree, {}, project);

      await migrator.migrate();

      const { tasksRunnerOptions } = readWorkspaceConfiguration(tree);
      expect(
        tasksRunnerOptions.default.options.cacheableOperations
      ).toStrictEqual(['build', 'lint', 'test', 'e2e', 'myCustomTest']);
    });
  });
});
