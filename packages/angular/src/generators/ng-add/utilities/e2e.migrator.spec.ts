import {
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { E2eMigrator } from './e2e.migrator';
import { MigrationProjectConfiguration } from './types';

type AngularCliProjectConfiguration = Omit<ProjectConfiguration, 'targets'> & {
  architect?: {
    [targetName: string]: Omit<TargetConfiguration, 'executor'> & {
      builder: string;
    };
  };
};

const mockedLogger = { warn: jest.fn() };

describe('e2e migrator', () => {
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
    it('should succeed validation when the project does not have an e2e target', async () => {
      const project = addProject('app1', { root: '' });
      const migrator = new E2eMigrator(tree, {}, project, undefined);

      const result = migrator.validate();

      expect(result).toBe(null);
    });

    it('should fail validation when the e2e target is not specifying any options', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          e2e: { builder: '@angular-devkit/build-angular:protractor' },
        },
      });
      const migrator = new E2eMigrator(tree, {}, project, undefined);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The "e2e" target is not specifying any options.'
      );
      expect(result[0].hint).toBe(
        'Make sure the "app1.architect.e2e.options" is correctly set or remove the "app1.architect.e2e" target if it is not valid.'
      );
    });

    it('should fail validation when using Protractor and the protractorConfig option is not set', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          e2e: {
            builder: '@angular-devkit/build-angular:protractor',
            options: {},
          },
        },
      });
      const migrator = new E2eMigrator(tree, {}, project, undefined);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The "e2e" target is using the "@angular-devkit/build-angular:protractor" builder but the Protractor config file is not specified.'
      );
      expect(result[0].hint).toBe(
        'Make sure the "app1.architect.e2e.options.protractorConfig" is correctly set or remove the "app1.architect.e2e" target if it is not valid.'
      );
    });

    it('should fail validation when using Protractor and the specified protractorConfig does not exist', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          e2e: {
            builder: '@angular-devkit/build-angular:protractor',
            options: { protractorConfig: 'protractor.conf.js' },
          },
        },
      });
      const migrator = new E2eMigrator(tree, {}, project, undefined);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The specified Protractor config file "protractor.conf.js" in the "e2e" target could not be found.'
      );
      expect(result[0].hint).toBe(
        'Make sure the "app1.architect.e2e.options.protractorConfig" is set to a valid path or remove the "app1.architect.e2e" target if it is not valid.'
      );
    });

    it('should succeed validation when using Protractor ', async () => {
      tree.write('protractor.conf.js', '');
      const project = addProject('app1', {
        root: '',
        architect: {
          e2e: {
            builder: '@angular-devkit/build-angular:protractor',
            options: { protractorConfig: 'protractor.conf.js' },
          },
        },
      });
      const migrator = new E2eMigrator(tree, {}, project, undefined);

      const result = migrator.validate();

      expect(result).toBe(null);
    });

    it('should fail validation when using Cypress and the cypress.json file does not exist', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          e2e: { builder: '@cypress/schematic:cypress', options: {} },
        },
      });
      const migrator = new E2eMigrator(tree, {}, project, undefined);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The "e2e" target is using the "@cypress/schematic:cypress" builder but the "configFile" option is not specified and a "cypress.json" file could not be found at the project root.'
      );
      expect(result[0].hint).toBe(
        'Make sure the "app1.architect.e2e.options.configFile" option is set to a valid path, or that a "cypress.json" file exists at the project root, or remove the "app1.architect.e2e" target if it is not valid.'
      );
    });

    it('should fail validation when using Cypress and the specified config file does not exist', async () => {
      const project = addProject('app1', {
        root: '',
        architect: {
          e2e: {
            builder: '@cypress/schematic:cypress',
            options: { configFile: 'cypress.conf.json' },
          },
        },
      });
      const migrator = new E2eMigrator(tree, {}, project, undefined);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The specified Cypress config file "cypress.conf.json" in the "e2e" target could not be found.'
      );
      expect(result[0].hint).toBe(
        'Make sure the "app1.architect.e2e.options.configFile" option is set to a valid path or remove the "app1.architect.e2e" target if it is not valid.'
      );
    });

    it('should fail validation when using Cypress and the cypress folder does not exist', async () => {
      writeJson(tree, 'cypress.json', {});
      const project = addProject('app1', {
        root: '',
        architect: {
          e2e: { builder: '@cypress/schematic:cypress', options: {} },
        },
      });
      const migrator = new E2eMigrator(tree, {}, project, undefined);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The "e2e" target is using the "@cypress/schematic:cypress" builder but the "cypress" directory could not be found at the project root.'
      );
      expect(result[0].hint).toBe(
        'Make sure the "cypress" directory exists in the project root or remove the "e2e" target if it is not valid.'
      );
    });

    it('should succeed validation when using Cypress', async () => {
      writeJson(tree, 'cypress.json', {});
      writeJson(tree, 'cypress/tsconfig.json', {});
      const project = addProject('app1', {
        root: '',
        architect: {
          e2e: { builder: '@cypress/schematic:cypress', options: {} },
        },
      });
      const migrator = new E2eMigrator(tree, {}, project, undefined);

      const result = migrator.validate();

      expect(result).toBe(null);
    });
  });

  describe('warnings', () => {
    it('should warn when using Protractor and the tsConfig file does not exist in the e2e root', async () => {
      tree.write('e2e/protractor.conf.js', '');
      const project = addProject('app1', {
        root: '',
        architect: {
          e2e: {
            builder: '@angular-devkit/build-angular:protractor',
            options: { protractorConfig: 'e2e/protractor.conf.js' },
          },
        },
      });
      const migrator = new E2eMigrator(
        tree,
        {},
        project,
        undefined,
        mockedLogger as any
      );

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'A "tsconfig.json" file could not be found for the e2e project. Skipping updating the tsConfig file.'
      );
    });

    it('should warn when using Cypress and the tsConfig file does not exist in the e2e root', async () => {
      writeJson(tree, 'cypress.json', {});
      writeJson(tree, 'cypress/README.md', {});
      const project = addProject('app1', {
        root: '',
        architect: {
          e2e: { builder: '@cypress/schematic:cypress', options: {} },
        },
      });
      const migrator = new E2eMigrator(
        tree,
        {},
        project,
        undefined,
        mockedLogger as any
      );

      await expect(migrator.migrate()).resolves.not.toThrow();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'A "tsconfig.json" file could not be found for the e2e project. Skipping updating the tsConfig file.'
      );
    });
  });

  describe.each(['', 'projects/app1'])(
    'protractor with project root at "%s"',
    (root) => {
      it('should move files', async () => {
        tree.write(joinPathFragments(root, 'e2e/protractor.conf.js'), '');
        writeJson(tree, joinPathFragments(root, 'e2e/tsconfig.json'), {});
        const project = addProject('app1', {
          root,
          architect: {
            e2e: {
              builder: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: joinPathFragments(
                  root,
                  'e2e/protractor.conf.js'
                ),
              },
            },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        expect(tree.exists('protractor.conf.js')).toBe(false);
        expect(tree.exists('apps/app1-e2e/protractor.conf.js')).toBe(true);
        expect(tree.exists('e2e/tsconfig.json')).toBe(false);
        expect(tree.exists('apps/app1-e2e/tsconfig.json')).toBe(true);
      });

      it('should add the project configuration for the new e2e project', async () => {
        tree.write(joinPathFragments(root, 'e2e/protractor.conf.js'), '');
        const project = addProject('app1', {
          root,
          architect: {
            e2e: {
              builder: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: joinPathFragments(
                  root,
                  'e2e/protractor.conf.js'
                ),
              },
            },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        const angularJson = readJson(tree, 'angular.json');
        expect(angularJson.projects['app1-e2e']).toBe('apps/app1-e2e');
        const e2eProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(e2eProject).toStrictEqual({
          root: 'apps/app1-e2e',
          sourceRoot: 'apps/app1-e2e/src',
          projectType: 'application',
          targets: {
            e2e: {
              executor: '@angular-devkit/build-angular:protractor',
              options: { protractorConfig: 'apps/app1-e2e/protractor.conf.js' },
            },
          },
          implicitDependencies: ['app1'],
          tags: [],
        });
      });

      it('should remove the e2e target from the application project configuration', async () => {
        tree.write(joinPathFragments(root, 'e2e/protractor.conf.js'), '');
        const project = addProject('app1', {
          root,
          architect: {
            e2e: {
              builder: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: joinPathFragments(
                  root,
                  'e2e/protractor.conf.js'
                ),
              },
            },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        const appProject = readProjectConfiguration(tree, 'app1');
        expect(appProject.targets.e2e).toBeUndefined();
      });

      it('should add a lint target when the application is using it', async () => {
        tree.write(joinPathFragments(root, 'e2e/protractor.conf.js'), '');
        const project = addProject('app1', {
          root,
          architect: {
            e2e: {
              builder: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: joinPathFragments(
                  root,
                  'e2e/protractor.conf.js'
                ),
              },
            },
            lint: { builder: '@angular-eslint/builder:lint', options: {} },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, 'lint');

        await migrator.migrate();

        const appProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(appProject.targets.lint).toBeTruthy();
      });

      it('should not add a lint target when the application is not using it', async () => {
        tree.write(joinPathFragments(root, 'e2e/protractor.conf.js'), '');
        const project = addProject('app1', {
          root,
          architect: {
            e2e: {
              builder: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: joinPathFragments(
                  root,
                  'e2e/protractor.conf.js'
                ),
              },
            },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        const appProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(appProject.targets.lint).toBeUndefined();
      });
    }
  );

  describe.each(['', 'projects/app1'])(
    'cypress with project root at "%s"',
    (root) => {
      it('should move files', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress.json'), {});
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
        const project = addProject('app1', {
          root,
          architect: {
            e2e: { builder: '@cypress/schematic:cypress', options: {} },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        expect(tree.exists('apps/app1-e2e/cypress.json')).toBe(true);
        expect(tree.exists('apps/app1-e2e/tsconfig.json')).toBe(true);
      });

      it('should add the project configuration for the new e2e project', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress.json'), {});
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
        const project = addProject('app1', {
          root,
          architect: {
            e2e: { builder: '@cypress/schematic:cypress', options: {} },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        const angularJson = readJson(tree, 'angular.json');
        expect(angularJson.projects['app1-e2e']).toBe('apps/app1-e2e');
        const e2eProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(e2eProject).toStrictEqual({
          root: 'apps/app1-e2e',
          sourceRoot: 'apps/app1-e2e/src',
          projectType: 'application',
          targets: {
            e2e: {
              executor: '@nrwl/cypress:cypress',
              options: { cypressConfig: 'apps/app1-e2e/cypress.json' },
            },
          },
          implicitDependencies: ['app1'],
          tags: [],
        });
      });

      it('should remove the e2e targets from the application project configuration', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress.json'), {});
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
        const project = addProject('app1', {
          root,
          architect: {
            'cypress-run': {
              builder: '@cypress/schematic:cypress',
              options: {},
            },
            'cypress-open': {
              builder: '@cypress/schematic:cypress',
              options: {},
            },
            e2e: { builder: '@cypress/schematic:cypress', options: {} },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        const appProject = readProjectConfiguration(tree, 'app1');
        expect(appProject.targets['cypress-run']).toBeUndefined();
        expect(appProject.targets['cypress-open']).toBeUndefined();
        expect(appProject.targets.e2e).toBeUndefined();
      });

      it('should add the cypress-run and cypress-open targets when they are defined', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress.json'), {});
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
        const project = addProject('app1', {
          root,
          architect: {
            'cypress-run': {
              builder: '@cypress/schematic:cypress',
              options: {},
            },
            'cypress-open': {
              builder: '@cypress/schematic:cypress',
              options: {},
            },
            e2e: { builder: '@cypress/schematic:cypress', options: {} },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        const e2eProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(e2eProject).toStrictEqual({
          root: 'apps/app1-e2e',
          sourceRoot: 'apps/app1-e2e/src',
          projectType: 'application',
          targets: {
            'cypress-run': {
              executor: '@nrwl/cypress:cypress',
              options: { cypressConfig: 'apps/app1-e2e/cypress.json' },
            },
            'cypress-open': {
              executor: '@nrwl/cypress:cypress',
              options: { cypressConfig: 'apps/app1-e2e/cypress.json' },
            },
            e2e: {
              executor: '@nrwl/cypress:cypress',
              options: { cypressConfig: 'apps/app1-e2e/cypress.json' },
            },
          },
          implicitDependencies: ['app1'],
          tags: [],
        });
      });

      it('should set the tsConfig option if it was present', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress.json'), {});
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
        const project = addProject('app1', {
          root,
          architect: {
            'cypress-run': {
              builder: '@cypress/schematic:cypress',
              options: {
                tsConfig: joinPathFragments(root, 'cypress/tsconfig.json'),
              },
            },
            'cypress-open': {
              builder: '@cypress/schematic:cypress',
              options: {},
            },
            e2e: {
              builder: '@cypress/schematic:cypress',
              options: {
                tsConfig: joinPathFragments(root, 'cypress/tsconfig.json'),
              },
            },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        const e2eProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(e2eProject).toStrictEqual({
          root: 'apps/app1-e2e',
          sourceRoot: 'apps/app1-e2e/src',
          projectType: 'application',
          targets: {
            'cypress-run': {
              executor: '@nrwl/cypress:cypress',
              options: {
                cypressConfig: 'apps/app1-e2e/cypress.json',
                tsConfig: 'apps/app1-e2e/tsconfig.json',
              },
            },
            'cypress-open': {
              executor: '@nrwl/cypress:cypress',
              options: { cypressConfig: 'apps/app1-e2e/cypress.json' },
            },
            e2e: {
              executor: '@nrwl/cypress:cypress',
              options: {
                cypressConfig: 'apps/app1-e2e/cypress.json',
                tsConfig: 'apps/app1-e2e/tsconfig.json',
              },
            },
          },
          implicitDependencies: ['app1'],
          tags: [],
        });
      });

      it('should add a lint target when the application is using it', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress.json'), {});
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
        const project = addProject('app1', {
          root,
          architect: {
            e2e: { builder: '@cypress/schematic:cypress', options: {} },
            lint: { builder: '@angular-eslint/builder:lint', options: {} },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, 'lint');

        await migrator.migrate();

        const e2eProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(e2eProject.targets.lint).toBeTruthy();
      });

      it('should not add a lint target when the application is not using it', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress.json'), {});
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
        const project = addProject('app1', {
          root,
          architect: {
            e2e: { builder: '@cypress/schematic:cypress', options: {} },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        const e2eProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(e2eProject.targets.lint).toBeUndefined();
      });

      it('should update the tsconfig.json', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress.json'), {});
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {
          extends: joinPathFragments(offsetFromRoot(root), 'tsconfig.json'),
        });
        const project = addProject('app1', {
          root,
          architect: {
            e2e: { builder: '@cypress/schematic:cypress', options: {} },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        const tsConfigJson = readJson(tree, 'apps/app1-e2e/tsconfig.json');
        expect(tsConfigJson.extends).toBe('../../tsconfig.base.json');
        expect(tsConfigJson.compilerOptions.outDir).toBe('../../dist/out-tsc');
      });

      it('should create a cypress.json file when it does not exist', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
        const project = addProject('app1', {
          root,
          architect: {
            e2e: {
              builder: '@cypress/schematic:cypress',
              options: { configFile: false },
            },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        expect(tree.exists('apps/app1-e2e/cypress.json')).toBe(true);
        const cypressJson = readJson(tree, 'apps/app1-e2e/cypress.json');
        expect(cypressJson).toStrictEqual({
          fileServerFolder: '.',
          fixturesFolder: './src/fixtures',
          integrationFolder: './src/integration',
          modifyObstructiveCode: false,
          supportFile: './src/support/index.ts',
          pluginsFile: './src/plugins/index.ts',
          video: true,
          videosFolder: `../../dist/cypress/apps/app1-e2e/videos`,
          screenshotsFolder: `../../dist/cypress/apps/app1-e2e/screenshots`,
          chromeWebSecurity: false,
        });
      });

      it('should update the cypress.json file', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
        writeJson(tree, joinPathFragments(root, 'cypress.json'), {
          integrationFolder: joinPathFragments(root, 'cypress/integration'),
          supportFile: joinPathFragments(root, 'cypress/support/index.ts'),
          videosFolder: joinPathFragments(root, 'cypress/videos'),
          screenshotsFolder: joinPathFragments(root, 'cypress/screenshots'),
          pluginsFile: joinPathFragments(root, 'cypress/plugins/index.ts'),
          fixturesFolder: joinPathFragments(root, 'cypress/fixtures'),
          baseUrl: 'http://localhost:4200',
        });
        const project = addProject('app1', {
          root,
          architect: {
            e2e: { builder: '@cypress/schematic:cypress', options: {} },
          },
        });
        const migrator = new E2eMigrator(tree, {}, project, undefined);

        await migrator.migrate();

        const cypressJson = readJson(tree, 'apps/app1-e2e/cypress.json');
        expect(cypressJson).toStrictEqual({
          integrationFolder: './src/integration',
          supportFile: './src/support/index.ts',
          videosFolder: `../../dist/cypress/apps/app1-e2e/videos`,
          screenshotsFolder: `../../dist/cypress/apps/app1-e2e/screenshots`,
          pluginsFile: './src/plugins/index.ts',
          fixturesFolder: './src/fixtures',
          baseUrl: 'http://localhost:4200',
          fileServerFolder: '.',
        });
      });
    }
  );
});
