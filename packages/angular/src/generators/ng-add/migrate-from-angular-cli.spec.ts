import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
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
      tree.write('/package.json', JSON.stringify({ name: '@my-org/monorepo' }));
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
                  builder: '@angular-eslint/builder:lint',
                  options: {
                    lintFilePatterns: ['src/**/*.ts', 'src/**/*.html'],
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
      tree.write(
        '.eslintrc.json',
        JSON.stringify({
          root: true,
          ignorePatterns: ['projects/**/*'],
          overrides: [
            {
              files: ['*.ts'],
              parserOptions: {
                project: ['tsconfig.json', 'e2e/tsconfig.json'],
                createDefaultProgram: true,
              },
              extends: [
                'plugin:@angular-eslint/recommended',
                'plugin:@angular-eslint/template/process-inline-templates',
              ],
              rules: {
                '@angular-eslint/directive-selector': [
                  'error',
                  { type: 'attribute', prefix: 'app', style: 'camelCase' },
                ],
                '@angular-eslint/component-selector': [
                  'error',
                  { type: 'element', prefix: 'app', style: 'kebab-case' },
                ],
              },
            },
            {
              files: ['*.html'],
              extends: ['plugin:@angular-eslint/template/recommended'],
              rules: {},
            },
          ],
        })
      );
      tree.write('/e2e/protractor.conf.js', '// content');
      tree.write('/src/app/app.module.ts', '// content');
    });

    describe('for invalid workspaces', () => {
      it('should error if no package.json is present', async () => {
        tree.delete('package.json');

        await expect(migrateFromAngularCli(tree, {})).rejects.toThrow(
          'The "package.json" file could not be found.'
        );
      });

      it('should error if no e2e/protractor.conf.js is present', async () => {
        tree.delete('/e2e/protractor.conf.js');

        await expect(migrateFromAngularCli(tree, {})).rejects.toThrow(
          `The "e2e" target is using a Protractor builder but the Protractor config file "e2e/protractor.conf.js" could not be found.`
        );
      });

      it('should error when using cypress and cypress.json is not found', async () => {
        const project = readProjectConfiguration(tree, 'myApp');
        project.targets.e2e.executor = '@cypress/schematic:cypress';
        updateProjectConfiguration(tree, 'myApp', project);

        await expect(migrateFromAngularCli(tree, {})).rejects.toThrow(
          'The "e2e" target is using a Cypress builder but the Cypress config file "cypress.json" could not be found.'
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

        await expect(migrateFromAngularCli(tree, {})).rejects.toThrow(
          'The "e2e" target is using a Cypress builder but the Cypress config file "cypress.config.json" could not be found.'
        );
      });

      it('should error when using cypress and the cypress folder is not found', async () => {
        const project = readProjectConfiguration(tree, 'myApp');
        project.targets.e2e.executor = '@cypress/schematic:cypress';
        updateProjectConfiguration(tree, 'myApp', project);
        tree.write('cypress.json', '{}');

        await expect(migrateFromAngularCli(tree, {})).rejects.toThrow(
          'The "e2e" target is using a Cypress builder but the "cypress" directory could not be found.'
        );
      });

      it('should error when having an e2e project with an unknown executor', async () => {
        const project = readProjectConfiguration(tree, 'myApp');
        project.targets.e2e.executor = '@my-org/my-package:my-executor';
        updateProjectConfiguration(tree, 'myApp', project);

        await expect(migrateFromAngularCli(tree, {})).rejects.toThrow(
          'The "e2e" target is using an unsupported builder "@my-org/my-package:my-executor".'
        );
      });

      it('should error when having a lint target using an unknown executor', async () => {
        const project = readProjectConfiguration(tree, 'myApp');
        project.targets.lint.executor = '@my-org/my-package:my-executor';
        updateProjectConfiguration(tree, 'myApp', project);

        await expect(migrateFromAngularCli(tree, {})).rejects.toThrow(
          'The "lint" target is using an unsupported builder "@my-org/my-package:my-executor".'
        );
      });

      it('should error if no angular.json is present', async () => {
        tree.delete('angular.json');

        await expect(migrateFromAngularCli(tree, {})).rejects.toThrow(
          'The "angular.json" file could not be found.'
        );
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

        await expect(migrateFromAngularCli(tree, {})).rejects.toThrow(
          'Can not convert workspaces with more than 1 application.'
        );
      });
    });

    it('should update project configuration', async () => {
      await migrateFromAngularCli(tree, {});

      const angularJson = readJson(tree, 'angular.json');
      expect(angularJson.projects.myApp).toBe('apps/myApp');
      expect(readJson(tree, 'apps/myApp/project.json')).toMatchSnapshot();
    });

    it('should update the npm scripts', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          name: '@my-org/my-monorepo',
          scripts: {
            ng: 'ng',
            start: 'ng serve',
            build: 'ng build',
            watch: 'ng build --watch --configuration development',
            test: 'ng test',
          },
        })
      );

      await migrateFromAngularCli(tree, {});

      expect(readJson(tree, 'package.json').scripts).toStrictEqual({
        ng: 'nx',
        start: 'nx serve',
        build: 'nx build',
        watch: 'nx build --watch --configuration development',
        test: 'nx test',
        postinstall: 'node ./decorate-angular-cli.js',
      });
    });

    it('should handle existing postinstall script', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          name: '@my-org/my-monorepo',
          scripts: {
            postinstall: 'node some-awesome-script.js',
          },
        })
      );

      await migrateFromAngularCli(tree, {});

      expect(readJson(tree, 'package.json').scripts.postinstall).toEqual(
        'node some-awesome-script.js && node ./decorate-angular-cli.js'
      );
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
                  builder: '@angular-eslint/builder:lint',
                  options: {
                    lintFilePatterns: [
                      'projects/myApp/src/**/*.ts',
                      'projects/myApp/src/**/*.html',
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

      tree.write('/projects/myApp/.eslintrc.json', '{}');
      tree.write('/projects/myApp/tsconfig.app.json', '{}');
      tree.write('/projects/myApp/tsconfig.spec.json', '{}');
      tree.write('/projects/myApp/e2e/tsconfig.json', '{}');
      tree.write('/projects/myApp/e2e/protractor.conf.js', '// content');
      tree.write('/projects/myApp/src/app/app.module.ts', '// content');

      await migrateFromAngularCli(tree, {});

      const a = readJson(tree, '/angular.json');

      expect(a.newProjectRoot).toBeUndefined();
    });

    it('should set the default collection to @nrwl/angular', async () => {
      await migrateFromAngularCli(tree, {});
      expect(readJson(tree, 'nx.json').cli.defaultCollection).toBe(
        '@nrwl/angular'
      );
    });

    it('should create nx.json', async () => {
      await migrateFromAngularCli(tree, { defaultBase: 'main' });
      expect(readJson(tree, 'nx.json')).toMatchSnapshot();
    });

    it('should work if angular-cli workspace had tsconfig.base.json', async () => {
      tree.rename('tsconfig.json', 'tsconfig.base.json');
      await migrateFromAngularCli(tree, {});
      expect(readJson(tree, 'tsconfig.base.json')).toMatchSnapshot();
    });

    it('should update tsconfig.base.json if present', async () => {
      await migrateFromAngularCli(tree, {});
      expect(readJson(tree, 'tsconfig.base.json')).toMatchSnapshot();
    });

    it('should work without nested tsconfig files', async () => {
      await migrateFromAngularCli(tree, {});
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
                  builder: '@angular-eslint/builder:lint',
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
      await migrateFromAngularCli(tree, {});
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
                  builder: '@angular-eslint/builder:lint',
                  options: {
                    lintFilePatterns: [
                      'projects/myApp/src/**/*.ts',
                      'projects/myApp/src/**/*.html',
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
      tree.write('/projects/myApp/.eslintrc.json', '{}');
      tree.write('/projects/myApp/tsconfig.app.json', '{}');
      tree.write('/projects/myApp/tsconfig.spec.json', '{}');
      tree.write('/projects/myApp/e2e/tsconfig.json', '{}');
      tree.write('/projects/myApp/e2e/protractor.conf.js', '// content');
      tree.write('/projects/myApp/src/app/app.module.ts', '// content');

      await migrateFromAngularCli(tree, {});

      expect(tree.exists('/.eslintrc.json')).toBe(true);
      expect(tree.exists('/apps/myApp/tsconfig.app.json')).toBe(true);
      expect(tree.exists('/apps/myApp-e2e/protractor.conf.js')).toBe(true);
      expect(tree.exists('/apps/myApp/src/app/app.module.ts')).toBe(true);
    });

    it('should work with missing e2e, lint, or test targets', async () => {
      tree.write(
        'angular.json',
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
      tree.write('karma.conf.js', '// content');

      await migrateFromAngularCli(tree, {});

      expect(tree.exists('apps/myApp/tsconfig.app.json')).toBe(true);
      expect(tree.exists('apps/myApp/karma.conf.js')).toBe(true);
      expect(tree.exists('apps/myApp/.eslintrc.json')).toBe(true);
      expect(tree.exists('tsconfig.base.json')).toBe(true);
      expect(tree.exists('karma.conf.js')).toBe(true);
      expect(tree.exists('.eslintrc.json')).toBe(true);
    });

    it('should work with existing .prettierignore file', async () => {
      tree.write('/.prettierignore', '# existing ignore rules');
      await migrateFromAngularCli(tree, {});

      const prettierIgnore = tree.read('/.prettierignore').toString();
      expect(prettierIgnore).toBe('# existing ignore rules');
    });

    it('should update tsconfigs', async () => {
      tree.write('/.prettierignore', '# existing ignore rules');
      await migrateFromAngularCli(tree, {});

      const prettierIgnore = tree.read('/.prettierignore').toString();
      expect(prettierIgnore).toBe('# existing ignore rules');
    });

    it('should move the project eslint config', async () => {
      await migrateFromAngularCli(tree, {});

      expect(readJson(tree, 'apps/myApp/.eslintrc.json')).toMatchSnapshot();
    });

    it('should create a root eslint config', async () => {
      await migrateFromAngularCli(tree, {});

      expect(readJson(tree, '.eslintrc.json')).toMatchSnapshot();
    });

    it('should work when eslint is not being used', async () => {
      tree.delete('.eslintrc.json');
      updateJson(tree, 'angular.json', (json) => {
        delete json.projects.myApp.architect.lint;
        return json;
      });

      await migrateFromAngularCli(tree, {});

      expect(tree.exists('.eslintrc.json')).toBe(false);
    });

    describe('protractor', () => {
      it('should migrate e2e tests correctly', async () => {
        await migrateFromAngularCli(tree, {});

        expect(tree.exists('e2e')).toBe(false);
        expect(tree.exists('apps/myApp-e2e/protractor.conf.js')).toBe(true);
        expect(tree.exists('apps/myApp-e2e/tsconfig.json')).toBe(true);
        expect(tree.exists('apps/myApp-e2e/.eslintrc.json')).toBe(true);
      });
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
        await migrateFromAngularCli(tree, {});

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
        expect(tree.exists('/apps/myApp-e2e/.eslintrc.json')).toBe(true);
        expect(
          readJson(tree, '/apps/myApp-e2e/.eslintrc.json')
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

        await migrateFromAngularCli(tree, {});

        expect(tree.exists('cypress.json')).toBe(false);
        expect(tree.exists('cypress')).toBe(false);
        expect(tree.exists('/apps/myApp-e2e/tsconfig.json')).toBe(true);
        expect(tree.exists('/apps/myApp-e2e/cypress.json')).toBe(true);
        expect(tree.exists('/apps/myApp-e2e/.eslintrc.json')).toBe(true);
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

      it('should handle project configuration without cypress-run or cypress-open', async () => {
        const project = readProjectConfiguration(tree, 'myApp');
        delete project.targets['cypress-run'];
        delete project.targets['cypress-open'];
        updateProjectConfiguration(tree, 'myApp', project);

        await migrateFromAngularCli(tree, {});

        expect(tree.exists('cypress.json')).toBe(false);
        expect(tree.exists('cypress')).toBe(false);
        expect(tree.exists('/apps/myApp-e2e/tsconfig.json')).toBe(true);
        expect(tree.exists('/apps/myApp-e2e/cypress.json')).toBe(true);
        expect(tree.exists('/apps/myApp-e2e/.eslintrc.json')).toBe(true);
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

      it('should work when eslint is not being used', async () => {
        tree.delete('.eslintrc.json');
        updateJson(tree, 'angular.json', (json) => {
          delete json.projects.myApp.architect.lint;
          return json;
        });

        await migrateFromAngularCli(tree, {});

        expect(tree.exists('/apps/myApp-e2e/.eslintrc.json')).toBe(false);
        expect(tree.exists('cypress.json')).toBe(false);
        expect(tree.exists('cypress')).toBe(false);
        expect(tree.exists('/apps/myApp-e2e/tsconfig.json')).toBe(true);
        expect(tree.exists('/apps/myApp-e2e/cypress.json')).toBe(true);
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
        const project = readProjectConfiguration(tree, 'myApp-e2e');
        expect(project.targets.lint).toBeUndefined();
      });
    });

    it('should support multiple libraries', async () => {
      tree.write('projects/lib1/README.md', '');
      tree.write('projects/lib1/src/public-api.ts', '');
      tree.write('projects/lib2/README.md', '');
      tree.write('projects/lib2/src/public-api.ts', '');
      writeJson(tree, 'angular.json', {
        $schema: './node_modules/@angular/cli/lib/config/schema.json',
        version: 1,
        defaultProject: 'app1',
        newProjectRoot: 'projects',
        projects: {
          app1: {
            root: '',
            sourceRoot: 'src',
            projectType: 'application',
            architect: {
              build: {
                options: { tsConfig: 'tsconfig.app.json' },
              },
              test: {
                options: { tsConfig: 'tsconfig.spec.json' },
              },
              e2e: {
                builder: '@angular-devkit/build-angular:protractor',
                options: { protractorConfig: 'e2e/protractor.conf.js' },
              },
            },
          },
          lib1: {
            root: 'projects/lib1',
            sourceRoot: 'projects/lib1/src',
            projectType: 'library',
            architect: {
              build: {
                builder: '@angular-devkit/build-angular:ng-packagr',
                options: { tsConfig: 'projects/lib1/tsconfig.lib.json' },
              },
              test: {
                builder: '@angular-devkit/build-angular:karma',
                options: { tsConfig: 'projects/lib1/tsconfig.spec.json' },
              },
            },
          },
          lib2: {
            root: 'projects/lib2',
            sourceRoot: 'projects/lib2/src',
            projectType: 'library',
            architect: {
              build: {
                builder: '@angular-devkit/build-angular:ng-packagr',
                options: { tsConfig: 'projects/lib2/tsconfig.lib.json' },
              },
              test: {
                builder: '@angular-devkit/build-angular:karma',
                options: { tsConfig: 'projects/lib2/tsconfig.spec.json' },
              },
            },
          },
        },
      });

      await migrateFromAngularCli(tree, {});

      expect(readJson(tree, 'angular.json')).toStrictEqual({
        version: 2,
        projects: {
          app1: 'apps/app1',
          'app1-e2e': 'apps/app1-e2e',
          lib1: 'libs/lib1',
          lib2: 'libs/lib2',
        },
      });
      const lib1 = readProjectConfiguration(tree, 'lib1');
      expect(lib1.root).toBe('libs/lib1');
      expect(lib1.sourceRoot).toBe('libs/lib1/src');
      expect(tree.exists('libs/lib1/README.md')).toBe(true);
      expect(tree.exists('libs/lib1/src/public-api.ts')).toBe(true);
      const lib2 = readProjectConfiguration(tree, 'lib2');
      expect(lib2.root).toBe('libs/lib2');
      expect(lib2.sourceRoot).toBe('libs/lib2/src');
      expect(tree.exists('libs/lib2/README.md')).toBe(true);
      expect(tree.exists('libs/lib2/src/public-api.ts')).toBe(true);
    });
  });

  describe('--preserve-angular-cli-layout', () => {
    beforeEach(() => {
      tree.write(
        'package.json',
        JSON.stringify({ name: 'my-scope', devDependencies: {} })
      );
      tree.write('angular.json', JSON.stringify({ projects: { myproj: {} } }));
      tree.write('tsconfig.json', '{"compilerOptions": {}}');
    });

    it('should update package.json', async () => {
      await migrateFromAngularCli(tree, { preserveAngularCliLayout: true });

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['@nrwl/workspace']).toBeDefined();
      expect(devDependencies['nx']).toBeDefined();
    });

    it('should create nx.json', async () => {
      await migrateFromAngularCli(tree, { preserveAngularCliLayout: true });

      expect(readJson(tree, 'nx.json')).toMatchSnapshot();
    });

    it('should create decorate-angular-cli.js', async () => {
      await migrateFromAngularCli(tree, { preserveAngularCliLayout: true });

      expect(tree.exists('/decorate-angular-cli.js')).toBe(true);
      const { scripts } = readJson(tree, 'package.json');
      expect(scripts.postinstall).toBe('node ./decorate-angular-cli.js');
    });

    it('should support multiple projects', async () => {
      const angularJson = {
        $schema: './node_modules/@angular/cli/lib/config/schema.json',
        version: 1,
        defaultProject: 'app1',
        newProjectRoot: 'projects',
        projects: {
          app1: {
            root: '',
            sourceRoot: 'src',
            architect: {
              build: {
                options: { tsConfig: 'tsconfig.app.json' },
              },
              test: {
                options: { tsConfig: 'tsconfig.spec.json' },
              },
              e2e: {
                builder: '@angular-devkit/build-angular:protractor',
                options: { protractorConfig: 'e2e/protractor.conf.js' },
              },
            },
          },
          app2: {
            root: 'projects/app2',
            sourceRoot: 'projects/app2/src',
            architect: {
              build: {
                options: { tsConfig: 'projects/app2/tsconfig.app.json' },
              },
              test: {
                options: { tsConfig: 'projects/app2/tsconfig.spec.json' },
              },
              e2e: {
                builder: '@angular-devkit/build-angular:protractor',
                options: {
                  protractorConfig: 'projects/app2/e2e/protractor.conf.js',
                },
              },
            },
          },
          lib1: {
            root: 'projects/lib1',
            sourceRoot: 'projects/lib1/src',
            architect: {
              build: {
                options: { tsConfig: 'projects/lib1/tsconfig.lib.json' },
              },
              test: {
                options: { tsConfig: 'projects/lib1/tsconfig.spec.json' },
              },
            },
          },
        },
      };
      tree.write('/angular.json', JSON.stringify(angularJson));

      await migrateFromAngularCli(tree, { preserveAngularCliLayout: true });

      expect(readJson(tree, 'angular.json')).toStrictEqual(angularJson);
      expect(tree.exists('/decorate-angular-cli.js')).toBe(true);
      const { scripts } = readJson(tree, 'package.json');
      expect(scripts.postinstall).toBe('node ./decorate-angular-cli.js');
      expect(readJson(tree, 'nx.json')).toMatchSnapshot();
    });
  });
});
