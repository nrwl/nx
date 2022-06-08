import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
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
                  builder: '@angular-devkit/build-angular:browser',
                  options: {
                    tsConfig: 'tsconfig.app.json',
                  },
                  configurations: {},
                },
                test: {
                  builder: '@angular-devkit/build-angular:karma',
                  options: {
                    karmaConfig: 'karma.conf.js',
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

      it('should error if no angular.json is present', async () => {
        tree.delete('angular.json');

        await expect(migrateFromAngularCli(tree, {})).rejects.toThrow(
          'The "angular.json" file could not be found.'
        );
      });
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
                  builder: '@angular-devkit/build-angular:browser',
                  options: {
                    tsConfig: 'projects/myApp/tsconfig.app.json',
                  },
                  configurations: {},
                },
                test: {
                  builder: '@angular-devkit/build-angular:karma',
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
      expect(
        readJson(tree, 'nx.json').cli?.defaultCollection
      ).not.toBeDefined();
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

    it('should work with existing .prettierignore file', async () => {
      tree.write('/.prettierignore', '# existing ignore rules');
      await migrateFromAngularCli(tree, {});

      const prettierIgnore = tree.read('/.prettierignore').toString();
      expect(prettierIgnore).toBe('# existing ignore rules');
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

    it('should support multiple applications', async () => {
      writeJson(tree, 'tsconfig.app.json', {});
      writeJson(tree, 'tsconfig.spec.json', {});
      tree.write('src/main.ts', '');
      tree.write('e2e/protractor.conf.js', '');
      writeJson(tree, 'e2e/tsconfig.json', {});
      writeJson(tree, 'projects/app2/tsconfig.app.json', {});
      writeJson(tree, 'projects/app2/tsconfig.spec.json', {});
      tree.write('projects/app2/src/main.ts', '');
      tree.write('projects/app2/e2e/protractor.conf.js', '');
      writeJson(tree, 'projects/app2/e2e/tsconfig.json', {});
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
                builder: '@angular-devkit/build-angular:browser',
                options: { tsConfig: 'tsconfig.app.json' },
              },
              test: {
                builder: '@angular-devkit/build-angular:karma',
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
            projectType: 'application',
            architect: {
              build: {
                builder: '@angular-devkit/build-angular:browser',
                options: { tsConfig: 'projects/app2/tsconfig.app.json' },
              },
              test: {
                builder: '@angular-devkit/build-angular:karma',
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
        },
      });

      await migrateFromAngularCli(tree, {});

      expect(readJson(tree, 'angular.json')).toStrictEqual({
        version: 2,
        projects: {
          app1: 'apps/app1',
          'app1-e2e': 'apps/app1-e2e',
          app2: 'apps/app2',
          'app2-e2e': 'apps/app2-e2e',
        },
      });
      const app1 = readProjectConfiguration(tree, 'app1');
      expect(app1.root).toBe('apps/app1');
      expect(app1.sourceRoot).toBe('apps/app1/src');
      expect(tree.exists('apps/app1/tsconfig.app.json')).toBe(true);
      expect(tree.exists('apps/app1/tsconfig.spec.json')).toBe(true);
      expect(tree.exists('apps/app1/src/main.ts')).toBe(true);
      expect(tree.exists('src')).toBe(false);
      const app1E2e = readProjectConfiguration(tree, 'app1-e2e');
      expect(app1E2e.root).toBe('apps/app1-e2e');
      expect(tree.exists('apps/app1-e2e/protractor.conf.js')).toBe(true);
      expect(tree.exists('apps/app1-e2e/tsconfig.json')).toBe(true);
      expect(tree.exists('e2e')).toBe(false);
      const app2 = readProjectConfiguration(tree, 'app2');
      expect(app2.root).toBe('apps/app2');
      expect(app2.sourceRoot).toBe('apps/app2/src');
      expect(tree.exists('apps/app2/tsconfig.app.json')).toBe(true);
      expect(tree.exists('apps/app2/tsconfig.spec.json')).toBe(true);
      expect(tree.exists('apps/app2/src/main.ts')).toBe(true);
      expect(tree.exists('projects/app2/src')).toBe(false);
      const app2E2e = readProjectConfiguration(tree, 'app2-e2e');
      expect(app2E2e.root).toBe('apps/app2-e2e');
      expect(tree.exists('apps/app2-e2e/protractor.conf.js')).toBe(true);
      expect(tree.exists('apps/app2-e2e/tsconfig.json')).toBe(true);
      expect(tree.exists('projects/app2/e2e')).toBe(false);
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
                builder: '@angular-devkit/build-angular:browser',
                options: { tsConfig: 'tsconfig.app.json' },
              },
              test: {
                builder: '@angular-devkit/build-angular:karma',
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
                builder: '@angular-devkit/build-angular:browser',
                options: { tsConfig: 'tsconfig.app.json' },
              },
              test: {
                builder: '@angular-devkit/build-angular:karma',
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
                builder: '@angular-devkit/build-angular:browser',
                options: { tsConfig: 'projects/app2/tsconfig.app.json' },
              },
              test: {
                builder: '@angular-devkit/build-angular:karma',
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
                builder: '@angular-devkit/build-angular:ng-packagr',
                options: { tsConfig: 'projects/lib1/tsconfig.lib.json' },
              },
              test: {
                builder: '@angular-devkit/build-angular:karma',
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
