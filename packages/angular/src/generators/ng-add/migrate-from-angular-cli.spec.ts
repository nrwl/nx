import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';

import { migrateFromAngularCli } from './migrate-from-angular-cli';

describe('workspace', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  describe('move to nx layout', () => {
    beforeEach(() => {
      tree.write('/package.json', JSON.stringify({}));
      tree.write(
        '/angular.json',
        JSON.stringify({
          version: 1,
          defaultProject: 'myApp',
          projects: {
            myApp: {
              root: '',
              sourceRoot: 'src',
              architect: {
                build: {
                  options: {
                    tsConfig: 'tsconfig.app.json',
                  },
                  configurations: {},
                },
                test: {
                  options: {
                    tsConfig: 'tsconfig.spec.json',
                  },
                },
                lint: {
                  options: {
                    tsConfig: 'tsconfig.app.json',
                  },
                },
                e2e: {
                  builder: '@angular-devkit/build-angular:protractor',
                  options: {
                    protractorConfig: 'e2e/protractor.conf.js',
                  },
                },
              },
            },
          },
        })
      );
      tree.write(
        '/tsconfig.app.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      tree.write(
        '/tsconfig.spec.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      tree.write(
        '/e2e/tsconfig.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      tree.write('/tsconfig.json', '{"compilerOptions": {}}');
      tree.write('/tslint.json', '{"rules": {}}');
      tree.write('/e2e/protractor.conf.js', '// content');
      tree.write('/src/app/app.module.ts', '// content');
    });

    describe('for invalid workspaces', () => {
      it('should error if no package.json is present', async () => {
        tree.delete('package.json');
        try {
          await migrateFromAngularCli(tree, { name: 'myApp' });
          fail('should throw');
        } catch (e) {
          expect(e.message).toContain('Cannot find package.json');
        }
      });

      it('should error if no e2e/protractor.conf.js is present', async () => {
        tree.delete('/e2e/protractor.conf.js');

        try {
          await migrateFromAngularCli(tree, { name: 'proj1' });
        } catch (e) {
          expect(e.message).toContain(
            'An e2e project with Protractor was found but "e2e/protractor.conf.js" could not be found.'
          );
        }
      });

      it('should error when using cypress and cypress.json is not found', async () => {
        const project = readProjectConfiguration(tree, 'myApp');
        project.targets.e2e.executor = '@cypress/schematic:cypress';
        updateProjectConfiguration(tree, 'myApp', project);

        await expect(
          migrateFromAngularCli(tree, { name: 'myApp' })
        ).rejects.toThrow(
          'An e2e project with Cypress was found but "cypress.json" could not be found.'
        );
      });

      it('should error when using cypress and the specified cypress config file is not found', async () => {
        const project = readProjectConfiguration(tree, 'myApp');
        project.targets.e2e = {
          executor: '@cypress/schematic:cypress',
          options: {
            configFile: 'cypress.config.json',
          },
        };
        updateProjectConfiguration(tree, 'myApp', project);

        await expect(
          migrateFromAngularCli(tree, { name: 'myApp' })
        ).rejects.toThrow(
          'An e2e project with Cypress was found but "cypress.config.json" could not be found.'
        );
      });

      it('should error when using cypress and the cypress folder is not found', async () => {
        const project = readProjectConfiguration(tree, 'myApp');
        project.targets.e2e.executor = '@cypress/schematic:cypress';
        updateProjectConfiguration(tree, 'myApp', project);
        tree.write('cypress.json', '{}');

        await expect(
          migrateFromAngularCli(tree, { name: 'myApp' })
        ).rejects.toThrow(
          'An e2e project with Cypress was found but the "cypress" directory could not be found.'
        );
      });

      it('should error when having an e2e project with an unknown executor', async () => {
        const project = readProjectConfiguration(tree, 'myApp');
        project.targets.e2e.executor = '@my-org/my-package:my-executor';
        updateProjectConfiguration(tree, 'myApp', project);

        await expect(
          migrateFromAngularCli(tree, { name: 'myApp' })
        ).rejects.toThrow(
          `An e2e project was found but it's using an unsupported executor "@my-org/my-package:my-executor".`
        );
      });

      it('should error if no angular.json is present', async () => {
        try {
          tree.delete('angular.json');
          await migrateFromAngularCli(tree, { name: 'myApp' });
        } catch (e) {
          expect(e.message).toContain('Cannot find angular.json');
        }
      });

      it('should error if the angular.json specifies more than one app', async () => {
        tree.write(
          '/angular.json',
          JSON.stringify({
            projects: {
              proj1: {},
              'proj1-e2e': {},
              proj2: {},
              'proj2-e2e': {},
            },
          })
        );
        try {
          await migrateFromAngularCli(tree, { name: 'myApp' });
        } catch (e) {
          expect(e.message).toContain('Can only convert projects with one app');
        }
      });
    });

    it('should error if the angular.json has only one library', async () => {
      tree.write(
        '/angular.json',
        JSON.stringify({
          projects: {
            proj1: {
              projectType: 'library',
            },
          },
        })
      );
      try {
        await migrateFromAngularCli(tree, { name: 'myApp' });
      } catch (e) {
        expect(e.message).toContain('Can only convert projects with one app');
      }
    });

    it('should remove the newProjectRoot key from configuration', async () => {
      tree.write(
        '/angular.json',
        JSON.stringify({
          version: 1,
          defaultProject: 'myApp',
          newProjectRoot: 'projects',
          projects: {
            myApp: {
              root: 'projects/myApp',
              sourceRoot: 'projects/myApp/src',
              architect: {
                build: {
                  options: {
                    tsConfig: 'projects/myApp/tsconfig.app.json',
                  },
                  configurations: {},
                },
                test: {
                  options: {
                    tsConfig: 'projects/myApp/tsconfig.spec.json',
                  },
                },
                lint: {
                  options: {
                    tsConfig: [
                      'projects/myApp/tslint.json',
                      'projects/myApp/tsconfig.app.json',
                    ],
                  },
                },
                e2e: {
                  builder: '@angular-devkit/build-angular:protractor',
                  options: {
                    protractorConfig: 'projects/myApp/e2e/protractor.conf.js',
                  },
                },
              },
            },
          },
        })
      );

      tree.write('/projects/myApp/tslint.json', '{"rules": {}}');
      tree.write('/projects/myApp/tsconfig.app.json', '{}');
      tree.write('/projects/myApp/tsconfig.spec.json', '{}');
      tree.write('/projects/myApp/e2e/tsconfig.json', '{}');
      tree.write('/projects/myApp/e2e/protractor.conf.js', '// content');
      tree.write('/projects/myApp/src/app/app.module.ts', '// content');

      await migrateFromAngularCli(tree, { name: 'myApp' });

      const a = readJson(tree, '/angular.json');

      expect(a.newProjectRoot).toBeUndefined();
    });

    it('should set the default collection to @nrwl/angular', async () => {
      await migrateFromAngularCli(tree, { name: 'myApp' });
      expect(readJson(tree, 'nx.json').cli.defaultCollection).toBe(
        '@nrwl/angular'
      );
    });

    it('should create nx.json', async () => {
      await migrateFromAngularCli(tree, { name: 'myApp', defaultBase: 'main' });
      expect(readJson(tree, 'nx.json')).toMatchSnapshot();
    });

    it('should work if angular-cli workspace had tsconfig.base.json', async () => {
      tree.rename('tsconfig.json', 'tsconfig.base.json');
      await migrateFromAngularCli(tree, { name: 'myApp' });
      expect(readJson(tree, 'tsconfig.base.json')).toMatchSnapshot();
    });

    it('should update tsconfig.base.json if present', async () => {
      await migrateFromAngularCli(tree, { name: 'myApp' });
      expect(readJson(tree, 'tsconfig.base.json')).toMatchSnapshot();
    });

    it('should work without nested tsconfig files', async () => {
      await migrateFromAngularCli(tree, { name: 'myApp' });
      expect(tree.exists('/apps/myApp/tsconfig.app.json')).toBe(true);
    });

    it('should work with nested (sub-dir) tsconfig files', async () => {
      tree.write(
        '/angular.json',
        JSON.stringify({
          version: 1,
          defaultProject: 'myApp',
          projects: {
            myApp: {
              sourceRoot: 'src',
              architect: {
                build: {
                  options: {
                    tsConfig: 'src/tsconfig.app.json',
                  },
                  configurations: {},
                },
                test: {
                  options: {
                    tsConfig: 'src/tsconfig.spec.json',
                  },
                },
                lint: {
                  options: {
                    tsConfig: 'src/tsconfig.app.json',
                  },
                },
                e2e: {
                  builder: '@angular-devkit/build-angular:protractor',
                  options: {
                    protractorConfig: 'e2e/protractor.conf.js',
                  },
                },
              },
            },
          },
        })
      );
      tree.delete('tsconfig.app.json');
      tree.write(
        '/src/tsconfig.app.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      tree.delete('tsconfig.spec.json');
      tree.write(
        '/src/tsconfig.spec.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      await migrateFromAngularCli(tree, { name: 'myApp' });
      expect(tree.exists('/apps/myApp/tsconfig.app.json')).toBe(true);
    });

    it('should work with initial project outside of src', async () => {
      tree.write(
        '/angular.json',
        JSON.stringify({
          version: 1,
          defaultProject: 'myApp',
          newProjectRoot: 'projects',
          projects: {
            myApp: {
              root: 'projects/myApp',
              sourceRoot: 'projects/myApp/src',
              architect: {
                build: {
                  options: {
                    tsConfig: 'projects/myApp/tsconfig.app.json',
                  },
                  configurations: {},
                },
                test: {
                  options: {
                    tsConfig: 'projects/myApp/tsconfig.spec.json',
                  },
                },
                lint: {
                  options: {
                    tsConfig: [
                      'projects/myApp/tslint.json',
                      'projects/myApp/tsconfig.app.json',
                    ],
                  },
                },
                e2e: {
                  builder: '@angular-devkit/build-angular:protractor',
                  options: {
                    protractorConfig: 'projects/myApp/e2e/protractor.conf.js',
                  },
                },
              },
            },
          },
        })
      );
      tree.write('/projects/myApp/tslint.json', '{"rules": {}}');
      tree.write('/projects/myApp/tsconfig.app.json', '{}');
      tree.write('/projects/myApp/tsconfig.spec.json', '{}');
      tree.write('/projects/myApp/e2e/tsconfig.json', '{}');
      tree.write('/projects/myApp/e2e/protractor.conf.js', '// content');
      tree.write('/projects/myApp/src/app/app.module.ts', '// content');

      await migrateFromAngularCli(tree, { name: 'myApp' });

      expect(tree.exists('/tslint.json')).toBe(true);
      expect(tree.exists('/apps/myApp/tsconfig.app.json')).toBe(true);
      expect(tree.exists('/apps/myApp-e2e/protractor.conf.js')).toBe(true);
      expect(tree.exists('/apps/myApp/src/app/app.module.ts')).toBe(true);
    });

    it('should work with missing e2e, lint, or test targets', async () => {
      tree.write(
        '/angular.json',
        JSON.stringify({
          version: 1,
          defaultProject: 'myApp',
          projects: {
            myApp: {
              root: '',
              sourceRoot: 'src',
              architect: {
                build: {
                  options: {
                    tsConfig: 'tsconfig.app.json',
                  },
                  configurations: {},
                },
              },
            },
          },
        })
      );
      tree.write('/karma.conf.js', '// content');

      await migrateFromAngularCli(tree, { name: 'myApp' });

      expect(tree.exists('/apps/myApp/tsconfig.app.json')).toBe(true);
      expect(tree.exists('/apps/myApp/karma.conf.js')).toBe(true);

      expect(tree.exists('/karma.conf.js')).toBe(true);
    });

    it('should work with existing .prettierignore file', async () => {
      tree.write('/.prettierignore', '# existing ignore rules');
      await migrateFromAngularCli(tree, { name: 'myApp' });

      const prettierIgnore = tree.read('/.prettierignore').toString();
      expect(prettierIgnore).toBe('# existing ignore rules');
    });

    it('should update tsconfigs', async () => {
      tree.write('/.prettierignore', '# existing ignore rules');
      await migrateFromAngularCli(tree, { name: 'myApp' });

      const prettierIgnore = tree.read('/.prettierignore').toString();
      expect(prettierIgnore).toBe('# existing ignore rules');
    });

    it('should work with no root tslint.json', async () => {
      tree.delete('/tslint.json');
      await migrateFromAngularCli(tree, { name: 'myApp' });

      expect(tree.exists('/tslint.json')).toBe(false);
    });

    describe('cypress', () => {
      beforeEach(() => {
        tree.write(
          '/angular.json',
          JSON.stringify({
            version: 1,
            defaultProject: 'myApp',
            projects: {
              myApp: {
                root: '',
                sourceRoot: 'src',
                architect: {
                  build: {
                    options: {
                      tsConfig: 'tsconfig.app.json',
                    },
                    configurations: {},
                  },
                  test: {
                    options: {
                      tsConfig: 'tsconfig.spec.json',
                    },
                  },
                  'cypress-run': {
                    builder: '@cypress/schematic:cypress',
                    options: {
                      devServerTarget: 'ng-cypress:serve',
                    },
                    configurations: {
                      production: {
                        devServerTarget: 'ng-cypress:serve:production',
                      },
                    },
                  },
                  'cypress-open': {
                    builder: '@cypress/schematic:cypress',
                    options: {
                      watch: true,
                      headless: false,
                    },
                  },
                  e2e: {
                    builder: '@cypress/schematic:cypress',
                    options: {
                      devServerTarget: 'ng-cypress:serve',
                      watch: true,
                      headless: false,
                    },
                    configurations: {
                      production: {
                        devServerTarget: 'ng-cypress:serve:production',
                      },
                    },
                  },
                },
              },
            },
          })
        );

        tree.write(
          'cypress.json',
          JSON.stringify({
            integrationFolder: 'cypress/integration',
            supportFile: 'cypress/support/index.ts',
            videosFolder: 'cypress/videos',
            screenshotsFolder: 'cypress/screenshots',
            pluginsFile: 'cypress/plugins/index.ts',
            fixturesFolder: 'cypress/fixtures',
            baseUrl: 'http://localhost:4200',
          })
        );
        tree.write('/cypress/fixtures/example.json', '{}');
        tree.write('/cypress/integration/spec.ts', '// content');
        tree.write('/cypress/plugins/index.ts', '// content');
        tree.write('/cypress/support/commands.ts', '// content');
        tree.write('/cypress/support/index.ts', '// content');
        tree.write('/cypress/tsconfig.json', '{"extends": "../tsconfig.json"}');
      });

      it('should migrate e2e tests correctly', async () => {
        await migrateFromAngularCli(tree, { name: 'myApp' });

        expect(tree.exists('cypress.json')).toBe(false);
        expect(tree.exists('cypress')).toBe(false);
        expect(tree.exists('/apps/myApp-e2e/tsconfig.json')).toBe(true);
        expect(
          readJson(tree, '/apps/myApp-e2e/tsconfig.json')
        ).toMatchSnapshot();
        expect(tree.exists('/apps/myApp-e2e/cypress.json')).toBe(true);
        expect(
          readJson(tree, '/apps/myApp-e2e/cypress.json')
        ).toMatchSnapshot();
        expect(tree.exists('/apps/myApp-e2e/src/fixtures/example.json')).toBe(
          true
        );
        expect(tree.exists('/apps/myApp-e2e/src/integration/spec.ts')).toBe(
          true
        );
        expect(tree.exists('/apps/myApp-e2e/src/plugins/index.ts')).toBe(true);
        expect(tree.exists('/apps/myApp-e2e/src/support/commands.ts')).toBe(
          true
        );
        expect(tree.exists('/apps/myApp-e2e/src/support/index.ts')).toBe(true);
        expect(readProjectConfiguration(tree, 'myApp-e2e')).toMatchSnapshot();
      });

      it('should migrate e2e tests when configFile is set to false and there is no cypress.json', async () => {
        const project = readProjectConfiguration(tree, 'myApp');
        project.targets.e2e.options.configFile = false;
        updateProjectConfiguration(tree, 'myApp', project);
        tree.delete('cypress.json');

        await migrateFromAngularCli(tree, { name: 'myApp' });

        expect(tree.exists('cypress.json')).toBe(false);
        expect(tree.exists('cypress')).toBe(false);
        expect(tree.exists('/apps/myApp-e2e/tsconfig.json')).toBe(true);
        expect(tree.exists('/apps/myApp-e2e/cypress.json')).toBe(true);
        expect(
          readJson(tree, '/apps/myApp-e2e/cypress.json')
        ).toMatchSnapshot();
        expect(tree.exists('/apps/myApp-e2e/src')).toBe(true);
        expect(readProjectConfiguration(tree, 'myApp-e2e')).toMatchSnapshot();
      });

      it('should handle project configuration without cypress-run or cypress-open', async () => {
        const project = readProjectConfiguration(tree, 'myApp');
        delete project.targets['cypress-run'];
        delete project.targets['cypress-open'];
        updateProjectConfiguration(tree, 'myApp', project);

        await migrateFromAngularCli(tree, { name: 'myApp' });

        expect(tree.exists('cypress.json')).toBe(false);
        expect(tree.exists('cypress')).toBe(false);
        expect(tree.exists('/apps/myApp-e2e/tsconfig.json')).toBe(true);
        expect(tree.exists('/apps/myApp-e2e/cypress.json')).toBe(true);
        expect(tree.exists('/apps/myApp-e2e/src')).toBe(true);
        expect(readProjectConfiguration(tree, 'myApp-e2e')).toMatchSnapshot();
      });
    });
  });

  describe('preserve angular cli layout', () => {
    beforeEach(() => {
      tree.write('/package.json', JSON.stringify({ devDependencies: {} }));
      tree.write('/angular.json', JSON.stringify({ projects: { myproj: {} } }));
      tree.write('/tsconfig.json', '{"compilerOptions": {}}');
    });

    it('should update package.json', async () => {
      await migrateFromAngularCli(tree, {
        name: 'myApp',
        preserveAngularCliLayout: true,
      });

      const d = readJson(tree, '/package.json').devDependencies;
      expect(d['@nrwl/workspace']).toBeDefined();
      expect(d['@nrwl/angular']).not.toBeDefined();
    });

    it('should create nx.json', async () => {
      await migrateFromAngularCli(tree, {
        name: 'myApp',
        preserveAngularCliLayout: true,
      });

      const nxJson = readJson(tree, '/nx.json');
      expect(nxJson.npmScope).toEqual('myproj');
    });

    it('should create decorate-angular-cli.js', async () => {
      await migrateFromAngularCli(tree, {
        name: 'myApp',
        preserveAngularCliLayout: true,
      });
      const s = readJson(tree, '/package.json').scripts;

      expect(tree.read('/decorate-angular-cli.js')).not.toBe(null);
      expect(s.postinstall).toEqual('node ./decorate-angular-cli.js');
    });
  });
});
