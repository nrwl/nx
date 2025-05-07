import 'nx/src/internal-testing-utils/mock-project-graph';

// mock so we can test multiple versions
jest.mock('@nx/cypress/src/utils/versions', () => ({
  ...jest.requireActual<any>('@nx/cypress/src/utils/versions'),
  getInstalledCypressMajorVersion: jest.fn(),
}));
// mock bc the nxE2EPreset uses fs for path normalization
jest.mock('fs', () => {
  return {
    ...jest.requireActual('fs'),
    lstatSync: jest.fn(() => ({
      isDirectory: jest.fn(() => true),
    })),
  };
});

import { getInstalledCypressMajorVersion } from '@nx/cypress/src/utils/versions';
import { formatFiles, ProjectConfiguration, Tree } from '@nx/devkit';
import {
  joinPathFragments,
  offsetFromRoot,
  readJson,
  readProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Logger, MigrationProjectConfiguration } from '../../utilities';
import { E2eMigrator } from './e2e.migrator';

const mockedLogger = { warn: jest.fn() };

describe('e2e migrator', () => {
  let tree: Tree;
  let migrator: E2eMigrator;
  let mockedInstalledCypressVersion =
    getInstalledCypressMajorVersion as jest.Mock<
      ReturnType<typeof getInstalledCypressMajorVersion>
    >;

  function addProject(
    name: string,
    config: ProjectConfiguration
  ): MigrationProjectConfiguration {
    config.projectType = 'application';
    writeJson(tree, `apps/${name}/project.json`, config);
    tree.write(`${config.root}/README.md`, '');
    tree.write(`${config.sourceRoot}/main.ts`, '');

    return {
      config: {
        ...readProjectConfiguration(tree, name),
        root: config.root,
      },
      name,
    };
  }

  function createMigrator(
    project: MigrationProjectConfiguration,
    lintTargetName?: string,
    logger?: Logger
  ): void {
    migrator = new E2eMigrator(tree, {}, project, lintTargetName, logger);
    // the app migrator does this before invoking e2e migrator, it's an implementation
    // detail for now until the e2e migrator is split into builder migrators
    project.config.root = 'apps/app1';
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // when this migrator is invoked, some of the workspace migration has
    // already been run, so we make some adjustments to match that state
    writeJson(tree, 'angular.json', { version: 2, projects: {} });

    mockedInstalledCypressVersion.mockReturnValue(9);

    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('should succeed validation when the project does not have an e2e target', async () => {
      const project = addProject('app1', { root: '' });
      createMigrator(project);

      const result = migrator.validate();

      expect(result).toBe(null);
    });

    it('should fail validation when the e2e target is not specifying any options', async () => {
      const project = addProject('app1', {
        root: '',
        targets: {
          e2e: { executor: '@angular-devkit/build-angular:protractor' },
        },
      });
      createMigrator(project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The "e2e" target is not specifying any options. The target will be skipped.'
      );
      expect(result[0].hint).toBe(
        'Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could revert the migration, ensure the "app1.architect.e2e.options" is correctly set or remove the target if it is not valid, and run the migration again.'
      );
    });

    it('should fail validation when using Protractor and the protractorConfig option is not set', async () => {
      const project = addProject('app1', {
        root: '',
        targets: {
          e2e: {
            executor: '@angular-devkit/build-angular:protractor',
            options: {},
          },
        },
      });
      createMigrator(project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The "e2e" target is using the "@angular-devkit/build-angular:protractor" builder but the Protractor config file is not specified. The target will be skipped.'
      );
      expect(result[0].hint).toBe(
        'Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could revert the migration, ensure the "app1.architect.e2e.options.protractorConfig" is correctly set or remove the "app1.architect.e2e" target if it is not valid, and run the migration again.'
      );
    });

    it('should fail validation when using Protractor and the specified protractorConfig does not exist', async () => {
      const project = addProject('app1', {
        root: '',
        targets: {
          e2e: {
            executor: '@angular-devkit/build-angular:protractor',
            options: { protractorConfig: 'protractor.conf.js' },
          },
        },
      });
      createMigrator(project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The specified Protractor config file "protractor.conf.js" in the "e2e" target could not be found. The target will be skipped.'
      );
      expect(result[0].hint).toBe(
        'Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could revert the migration, ensure the "app1.architect.e2e.options.protractorConfig" is set to a valid path or remove the "app1.architect.e2e" target if it is not valid, and run the migration again.'
      );
    });

    it('should succeed validation when using Protractor ', async () => {
      tree.write('protractor.conf.js', '');
      const project = addProject('app1', {
        root: '',
        targets: {
          e2e: {
            executor: '@angular-devkit/build-angular:protractor',
            options: { protractorConfig: 'protractor.conf.js' },
          },
        },
      });
      createMigrator(project);

      const result = migrator.validate();

      expect(result).toBe(null);
    });

    it('should fail validation when using Cypress and the specified config file does not exist', async () => {
      const project = addProject('app1', {
        root: '',
        targets: {
          e2e: {
            executor: '@cypress/schematic:cypress',
            options: { configFile: 'cypress.conf.json' },
          },
        },
      });
      createMigrator(project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The specified Cypress config file "cypress.conf.json" in the "e2e" target could not be found. The target will be skipped.'
      );
      expect(result[0].hint).toBe(
        'Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could revert the migration, ensure the "app1.architect.e2e.options.configFile" option is set to a valid path or remove the "app1.architect.e2e" target if it is not valid, and run the migration again.'
      );
    });

    it('should fail validation when using Cypress and the cypress folder does not exist', async () => {
      writeJson(tree, 'cypress.json', {});
      const project = addProject('app1', {
        root: '',
        targets: {
          e2e: { executor: '@cypress/schematic:cypress', options: {} },
        },
      });
      createMigrator(project);

      const result = migrator.validate();

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'The "e2e" target is using the "@cypress/schematic:cypress" builder but the "cypress" directory could not be found at the project root. The target will be skipped.'
      );
      expect(result[0].hint).toBe(
        'Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could revert the migration, ensure the "cypress" directory exists in the project root or remove the "e2e" target if it is not valid, and run the migration again.'
      );
    });

    describe('cypress version <10', () => {
      it('should fail validation when using Cypress and the cypress.json file does not exist', async () => {
        const project = addProject('app1', {
          root: '',
          targets: {
            e2e: { executor: '@cypress/schematic:cypress', options: {} },
          },
        });
        createMigrator(project);

        const result = migrator.validate();

        expect(result).toHaveLength(1);
        expect(result[0].message).toBe(
          'The "e2e" target is using the "@cypress/schematic:cypress" builder but the "configFile" option is not specified and a "cypress.json" file could not be found at the project root. The target will be skipped.'
        );
        expect(result[0].hint).toBe(
          'Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could revert the migration, ensure the "app1.architect.e2e.options.configFile" option is set to a valid path or that a "cypress.json" file exists at the project root or remove the "app1.architect.e2e" target if it is not valid, and run the migration again.'
        );
      });

      it('should fail validation when using Cypress and the specified config file does not exist', async () => {
        const project = addProject('app1', {
          root: '',
          targets: {
            e2e: {
              executor: '@cypress/schematic:cypress',
              options: { configFile: 'cypress.conf.json' },
            },
          },
        });
        createMigrator(project);

        const result = migrator.validate();

        expect(result).toHaveLength(1);
        expect(result[0].message).toBe(
          'The specified Cypress config file "cypress.conf.json" in the "e2e" target could not be found. The target will be skipped.'
        );
        expect(result[0].hint).toBe(
          'Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could revert the migration, ensure the "app1.architect.e2e.options.configFile" option is set to a valid path or remove the "app1.architect.e2e" target if it is not valid, and run the migration again.'
        );
      });

      it('should succeed validation when using Cypress', async () => {
        writeJson(tree, 'cypress.json', {});
        writeJson(tree, 'cypress/tsconfig.json', {});
        const project = addProject('app1', {
          root: '',
          targets: {
            e2e: { executor: '@cypress/schematic:cypress', options: {} },
          },
        });
        createMigrator(project);

        const result = migrator.validate();

        expect(result).toBe(null);
      });
    });

    describe('cypress version >=10', () => {
      it('should fail validation when using Cypress and a cypress.config.{ts,js,mjs,cjs} file does not exist', async () => {
        mockedInstalledCypressVersion.mockReturnValue(10);
        const project = addProject('app1', {
          root: '',
          targets: {
            e2e: { executor: '@cypress/schematic:cypress', options: {} },
          },
        });
        createMigrator(project);

        const result = migrator.validate();

        expect(result).toHaveLength(1);
        expect(result[0].message).toBe(
          'The "e2e" target is using the "@cypress/schematic:cypress" builder but the "configFile" option is not specified and a "cypress.config.{ts,js,mjs,cjs}" file could not be found at the project root. The target will be skipped.'
        );
        expect(result[0].hint).toBe(
          'Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could revert the migration, ensure the "app1.architect.e2e.options.configFile" option is set to a valid path or that a "cypress.config.{ts,js,mjs,cjs}" file exists at the project root or remove the "app1.architect.e2e" target if it is not valid, and run the migration again.'
        );
      });

      it('should succeed validation when using Cypress', async () => {
        mockedInstalledCypressVersion.mockReturnValue(10);
        tree.write('cypress.config.ts', '');
        writeJson(tree, 'cypress/tsconfig.json', {});
        const project = addProject('app1', {
          root: '',
          targets: {
            e2e: { executor: '@cypress/schematic:cypress', options: {} },
          },
        });
        createMigrator(project);

        const result = migrator.validate();

        expect(result).toBe(null);
      });
    });
  });

  describe('warnings', () => {
    it('should warn when using Protractor and the tsConfig file does not exist in the e2e root', async () => {
      tree.write('e2e/protractor.conf.js', '');
      const project = addProject('app1', {
        root: '',
        targets: {
          e2e: {
            executor: '@angular-devkit/build-angular:protractor',
            options: { protractorConfig: 'e2e/protractor.conf.js' },
          },
        },
      });
      createMigrator(project, undefined, mockedLogger as any);

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
        targets: {
          e2e: { executor: '@cypress/schematic:cypress', options: {} },
        },
      });
      createMigrator(project, undefined, mockedLogger as any);

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
          targets: {
            e2e: {
              executor: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: joinPathFragments(
                  root,
                  'e2e/protractor.conf.js'
                ),
              },
            },
          },
        });
        createMigrator(project);

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
          targets: {
            e2e: {
              executor: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: joinPathFragments(
                  root,
                  'e2e/protractor.conf.js'
                ),
              },
            },
          },
        });
        createMigrator(project);

        await migrator.migrate();

        const angularJson = readJson(tree, 'angular.json');
        expect(angularJson.projects['app1-e2e']).toBeUndefined();
        const e2eProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(e2eProject).toStrictEqual({
          $schema: '../../node_modules/nx/schemas/project-schema.json',
          name: 'app1-e2e',
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
          targets: {
            e2e: {
              executor: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: joinPathFragments(
                  root,
                  'e2e/protractor.conf.js'
                ),
              },
            },
          },
        });
        createMigrator(project);

        await migrator.migrate();

        const appProject = readProjectConfiguration(tree, 'app1');
        expect(appProject.targets.e2e).toBeUndefined();
      });

      it('should add a lint target when the application is using it', async () => {
        tree.write(joinPathFragments(root, 'e2e/protractor.conf.js'), '');
        const project = addProject('app1', {
          root,
          targets: {
            e2e: {
              executor: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: joinPathFragments(
                  root,
                  'e2e/protractor.conf.js'
                ),
              },
            },
            lint: { executor: '@angular-eslint/builder:lint', options: {} },
          },
        });
        createMigrator(project, 'lint');

        await migrator.migrate();

        expect(tree.exists('apps/app1-e2e/.eslintrc.json')).toBe(true);
      });

      it('should not add a lint target when the application is not using it', async () => {
        tree.write(joinPathFragments(root, 'e2e/protractor.conf.js'), '');
        const project = addProject('app1', {
          root,
          targets: {
            e2e: {
              executor: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: joinPathFragments(
                  root,
                  'e2e/protractor.conf.js'
                ),
              },
            },
          },
        });
        createMigrator(project);

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
          targets: {
            e2e: { executor: '@cypress/schematic:cypress', options: {} },
          },
        });
        createMigrator(project);

        await migrator.migrate();

        expect(tree.exists('cypress.json')).toBe(false);
        expect(tree.exists('cypress/tsconfig.json')).toBe(false);
        expect(tree.exists('apps/app1-e2e/cypress.json')).toBe(true);
        expect(tree.exists('apps/app1-e2e/tsconfig.json')).toBe(true);
      });

      it('should add the project configuration for the new e2e project', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress.json'), {});
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
        const project = addProject('app1', {
          root,
          targets: {
            e2e: { executor: '@cypress/schematic:cypress', options: {} },
          },
        });
        createMigrator(project);

        await migrator.migrate();

        const angularJson = readJson(tree, 'angular.json');
        expect(angularJson.projects['app1-e2e']).toBeUndefined();
        const e2eProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(e2eProject).toStrictEqual({
          $schema: '../../node_modules/nx/schemas/project-schema.json',
          name: 'app1-e2e',
          root: 'apps/app1-e2e',
          sourceRoot: 'apps/app1-e2e/src',
          projectType: 'application',
          targets: {
            e2e: {
              executor: '@nx/cypress:cypress',
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
          targets: {
            'cypress-run': {
              executor: '@cypress/schematic:cypress',
              options: {},
            },
            'cypress-open': {
              executor: '@cypress/schematic:cypress',
              options: {},
            },
            e2e: { executor: '@cypress/schematic:cypress', options: {} },
          },
        });
        createMigrator(project);

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
          targets: {
            'cypress-run': {
              executor: '@cypress/schematic:cypress',
              options: {},
            },
            'cypress-open': {
              executor: '@cypress/schematic:cypress',
              options: {},
            },
            e2e: { executor: '@cypress/schematic:cypress', options: {} },
          },
        });
        createMigrator(project);

        await migrator.migrate();

        const e2eProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(e2eProject).toStrictEqual({
          $schema: '../../node_modules/nx/schemas/project-schema.json',
          name: 'app1-e2e',
          root: 'apps/app1-e2e',
          sourceRoot: 'apps/app1-e2e/src',
          projectType: 'application',
          targets: {
            'cypress-run': {
              executor: '@nx/cypress:cypress',
              options: { cypressConfig: 'apps/app1-e2e/cypress.json' },
            },
            'cypress-open': {
              executor: '@nx/cypress:cypress',
              options: { cypressConfig: 'apps/app1-e2e/cypress.json' },
            },
            e2e: {
              executor: '@nx/cypress:cypress',
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
          targets: {
            'cypress-run': {
              executor: '@cypress/schematic:cypress',
              options: {
                tsConfig: joinPathFragments(root, 'cypress/tsconfig.json'),
              },
            },
            'cypress-open': {
              executor: '@cypress/schematic:cypress',
              options: {},
            },
            e2e: {
              executor: '@cypress/schematic:cypress',
              options: {
                tsConfig: joinPathFragments(root, 'cypress/tsconfig.json'),
              },
            },
          },
        });
        createMigrator(project);

        await migrator.migrate();

        const e2eProject = readProjectConfiguration(tree, 'app1-e2e');
        expect(e2eProject).toStrictEqual({
          $schema: '../../node_modules/nx/schemas/project-schema.json',
          name: 'app1-e2e',
          root: 'apps/app1-e2e',
          sourceRoot: 'apps/app1-e2e/src',
          projectType: 'application',
          targets: {
            'cypress-run': {
              executor: '@nx/cypress:cypress',
              options: {
                cypressConfig: 'apps/app1-e2e/cypress.json',
                tsConfig: 'apps/app1-e2e/tsconfig.json',
              },
            },
            'cypress-open': {
              executor: '@nx/cypress:cypress',
              options: { cypressConfig: 'apps/app1-e2e/cypress.json' },
            },
            e2e: {
              executor: '@nx/cypress:cypress',
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
          targets: {
            e2e: { executor: '@cypress/schematic:cypress', options: {} },
            lint: { executor: '@angular-eslint/builder:lint', options: {} },
          },
        });
        createMigrator(project, 'lint');

        await migrator.migrate();

        expect(tree.exists('apps/app1-e2e/.eslintrc.json')).toBe(true);
      });

      it('should not add a lint target when the application is not using it', async () => {
        writeJson(tree, joinPathFragments(root, 'cypress.json'), {});
        writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
        const project = addProject('app1', {
          root,
          targets: {
            e2e: { executor: '@cypress/schematic:cypress', options: {} },
          },
        });
        createMigrator(project);

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
          targets: {
            e2e: { executor: '@cypress/schematic:cypress', options: {} },
          },
        });
        createMigrator(project);

        await migrator.migrate();

        const tsConfigJson = readJson(tree, 'apps/app1-e2e/tsconfig.json');
        expect(tsConfigJson.extends).toBe('../../tsconfig.base.json');
        expect(tsConfigJson.compilerOptions.outDir).toBe('../../dist/out-tsc');
      });

      describe('cypress version <10', () => {
        it('should create a cypress.json file when it does not exist', async () => {
          writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
          const project = addProject('app1', {
            root,
            targets: {
              e2e: {
                executor: '@cypress/schematic:cypress',
                options: { configFile: false },
              },
            },
          });
          createMigrator(project);

          await migrator.migrate();

          expect(tree.exists('apps/app1-e2e/cypress.json')).toBe(true);
          const cypressJson = readJson(tree, 'apps/app1-e2e/cypress.json');
          expect(cypressJson).toStrictEqual({
            fileServerFolder: '.',
            fixturesFolder: './src/fixtures',
            integrationFolder: './src/integration',
            modifyObstructiveCode: false,
            supportFile: './src/support/index.ts',
            pluginsFile: false,
            video: true,
            videosFolder: `../../dist/cypress/apps/app1-e2e/videos`,
            screenshotsFolder: `../../dist/cypress/apps/app1-e2e/screenshots`,
            chromeWebSecurity: false,
          });
        });

        it('should update the cypress.json file', async () => {
          writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
          writeJson(tree, joinPathFragments(root, 'cypress.json'), {
            integrationFolder: 'cypress/integration',
            supportFile: 'cypress/support/index.ts',
            videosFolder: 'cypress/videos',
            screenshotsFolder: 'cypress/screenshots',
            pluginsFile: 'cypress/plugins/index.ts',
            fixturesFolder: 'cypress/fixtures',
            baseUrl: 'http://localhost:4200',
          });
          const project = addProject('app1', {
            root,
            targets: {
              e2e: { executor: '@cypress/schematic:cypress', options: {} },
            },
          });
          createMigrator(project);

          await migrator.migrate();

          const cypressJson = readJson(tree, 'apps/app1-e2e/cypress.json');
          expect(cypressJson).toStrictEqual({
            integrationFolder: 'src/integration',
            supportFile: 'src/support/index.ts',
            videosFolder: `../../dist/cypress/apps/app1-e2e/videos`,
            screenshotsFolder: `../../dist/cypress/apps/app1-e2e/screenshots`,
            pluginsFile: 'src/plugins/index.ts',
            fixturesFolder: 'src/fixtures',
            baseUrl: 'http://localhost:4200',
            fileServerFolder: '.',
          });
        });
      });

      describe('cypress version >=10', () => {
        it('should create a cypress.config.ts file when it does not exist', async () => {
          mockedInstalledCypressVersion.mockReturnValue(10);
          writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
          const project = addProject('app1', {
            root,
            targets: {
              e2e: {
                executor: '@cypress/schematic:cypress',
                options: {},
              },
            },
          });
          createMigrator(project);

          await migrator.migrate();

          await formatFiles(tree);

          expect(tree.exists('apps/app1-e2e/cypress.config.ts')).toBe(true);
          const cypressConfig = tree.read(
            'apps/app1-e2e/cypress.config.ts',
            'utf-8'
          );

          expect(cypressConfig).toMatchSnapshot();
        });

        it('should update e2e config with the nx preset', async () => {
          mockedInstalledCypressVersion.mockReturnValue(10);
          writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
          tree.write(
            joinPathFragments(root, 'cypress.config.ts'),
            `import { defineConfig } from 'cypress';

            export default defineConfig({
              e2e: {
                baseUrl: 'http://localhost:4200'
              },
            });`
          );
          const project = addProject('app1', {
            root,
            targets: {
              e2e: { executor: '@cypress/schematic:cypress', options: {} },
            },
          });
          createMigrator(project);

          await migrator.migrate();

          expect(tree.exists('apps/app1-e2e/cypress.config.ts')).toBe(true);
          const cypressConfig = tree.read(
            'apps/app1-e2e/cypress.config.ts',
            'utf-8'
          );
          expect(cypressConfig).toMatchSnapshot();
        });

        it('should update paths in the config', async () => {
          mockedInstalledCypressVersion.mockReturnValue(10);
          writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
          tree.write(
            joinPathFragments(root, 'cypress.config.ts'),
            `import { defineConfig } from 'cypress';

export default defineConfig({
  fixturesFolder: 'cypress/fixtures',
  specPattern: 'cypress/**/*.cy.{js,jsx,ts,tsx}',
  e2e: {
    baseUrl: 'http://localhost:4200',
    fixturesFolder: 'cypress/test-data',
    specPattern: 'cypress/e2e/**/*.cy.ts',
  },
  component: {
    supportFile: 'cypress/support/component.ts',
  }
});`
          );
          const project = addProject('app1', {
            root,
            targets: {
              e2e: { executor: '@cypress/schematic:cypress', options: {} },
            },
          });
          createMigrator(project);

          await migrator.migrate();

          expect(tree.exists('apps/app1-e2e/cypress.config.ts')).toBe(true);
          const cypressConfig = tree.read(
            'apps/app1-e2e/cypress.config.ts',
            'utf-8'
          );
          expect(cypressConfig).toMatchSnapshot();
        });

        it('should remove paths in the e2e config when they match the nx preset defaults', async () => {
          mockedInstalledCypressVersion.mockReturnValue(10);
          writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
          tree.write(
            joinPathFragments(root, 'cypress.config.ts'),
            `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    fixturesFolder: 'cypress/fixtures',
    specPattern: 'cypress/**/*.cy.{js,jsx,ts,tsx}',
  },
});`
          );
          const project = addProject('app1', {
            root,
            targets: {
              e2e: { executor: '@cypress/schematic:cypress', options: {} },
            },
          });
          createMigrator(project);

          await migrator.migrate();

          expect(tree.exists('apps/app1-e2e/cypress.config.ts')).toBe(true);
          const cypressConfig = tree.read(
            'apps/app1-e2e/cypress.config.ts',
            'utf-8'
          );
          expect(cypressConfig).toMatchSnapshot();
        });

        it('should keep paths in the e2e config when they differ from the nx preset defaults', async () => {
          mockedInstalledCypressVersion.mockReturnValue(10);
          writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
          tree.write(
            joinPathFragments(root, 'cypress.config.ts'),
            `import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    fixturesFolder: 'cypress/my-fixtures',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
  },
});`
          );
          const project = addProject('app1', {
            root,
            targets: {
              e2e: { executor: '@cypress/schematic:cypress', options: {} },
            },
          });
          createMigrator(project);

          await migrator.migrate();

          expect(tree.exists('apps/app1-e2e/cypress.config.ts')).toBe(true);
          const cypressConfig = tree.read(
            'apps/app1-e2e/cypress.config.ts',
            'utf-8'
          );
          expect(cypressConfig).toMatchSnapshot();
        });

        it('should add paths to the e2e config from the global config when they differ from the nx preset defaults', async () => {
          mockedInstalledCypressVersion.mockReturnValue(10);
          writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
          tree.write(
            joinPathFragments(root, 'cypress.config.ts'),
            `import { defineConfig } from 'cypress';

export default defineConfig({
  fixturesFolder: 'cypress/my-fixtures',
  specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
  e2e: {
    baseUrl: 'http://localhost:4200',
  },
});`
          );
          const project = addProject('app1', {
            root,
            targets: {
              e2e: { executor: '@cypress/schematic:cypress', options: {} },
            },
          });
          createMigrator(project);

          await migrator.migrate();

          expect(tree.exists('apps/app1-e2e/cypress.config.ts')).toBe(true);
          const cypressConfig = tree.read(
            'apps/app1-e2e/cypress.config.ts',
            'utf-8'
          );
          expect(cypressConfig).toMatchSnapshot();
        });

        it('should not throw when the e2e config is not defined', async () => {
          mockedInstalledCypressVersion.mockReturnValue(10);
          writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
          tree.write(
            joinPathFragments(root, 'cypress.config.ts'),
            `import { defineConfig } from 'cypress';

export default defineConfig({});`
          );
          const project = addProject('app1', {
            root,
            targets: {
              e2e: { executor: '@cypress/schematic:cypress', options: {} },
            },
          });
          createMigrator(project);

          await expect(migrator.migrate()).resolves.not.toThrow();
        });

        it('should not throw when the e2e config is not an object literal', async () => {
          mockedInstalledCypressVersion.mockReturnValue(10);
          writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
          tree.write(
            joinPathFragments(root, 'cypress.config.ts'),
            `import { defineConfig } from 'cypress';
const e2e = {};
export default defineConfig({ e2e });`
          );
          const project = addProject('app1', {
            root,
            targets: {
              e2e: { executor: '@cypress/schematic:cypress', options: {} },
            },
          });
          createMigrator(project);

          await expect(migrator.migrate()).resolves.not.toThrow();
        });

        it('should not throw when the "defineConfig" call is not found', async () => {
          mockedInstalledCypressVersion.mockReturnValue(10);
          writeJson(tree, joinPathFragments(root, 'cypress/tsconfig.json'), {});
          tree.write(joinPathFragments(root, 'cypress.config.ts'), '');
          const project = addProject('app1', {
            root,
            targets: {
              e2e: { executor: '@cypress/schematic:cypress', options: {} },
            },
          });
          createMigrator(project);

          await expect(migrator.migrate()).resolves.not.toThrow();
        });
      });
    }
  );
});
