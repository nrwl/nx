import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';

import { initGenerator } from './init';

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
          await initGenerator(tree, { name: 'myApp' });
          fail('should throw');
        } catch (e) {
          expect(e.message).toContain('Cannot find package.json');
        }
      });

      it('should error if no e2e/protractor.conf.js is present', async () => {
        tree.delete('/e2e/protractor.conf.js');

        try {
          await initGenerator(tree, { name: 'proj1' });
        } catch (e) {
          expect(e.message).toContain(
            'An e2e project was specified but e2e/protractor.conf.js could not be found.'
          );
        }
      });

      it('should not error if project does not use protractor', async () => {
        tree.delete('/e2e/protractor.conf.js');

        const proj = readProjectConfiguration(tree, 'myApp');
        proj.targets.e2e.executor = '@nrwl/cypress';
        updateProjectConfiguration(tree, 'myApp', proj);

        await initGenerator(tree, { name: 'myApp' });
      });

      it('should error if no angular.json is present', async () => {
        try {
          tree.delete('angular.json');
          await initGenerator(tree, { name: 'myApp' });
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
          await initGenerator(tree, { name: 'myApp' });
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
        await initGenerator(tree, { name: 'myApp' });
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

      await initGenerator(tree, { name: 'myApp' });

      const a = readJson(tree, '/angular.json');

      expect(a.newProjectRoot).toBeUndefined();
    });

    it('should set the default collection to @nrwl/angular', async () => {
      await initGenerator(tree, { name: 'myApp' });
      expect(readJson(tree, 'nx.json').cli.defaultCollection).toBe(
        '@nrwl/angular'
      );
    });

    it('should create nx.json', async () => {
      await initGenerator(tree, { name: 'myApp', defaultBase: 'main' });
      expect(readJson(tree, 'nx.json')).toMatchSnapshot();
    });

    it('should work if angular-cli workspace had tsconfig.base.json', async () => {
      tree.rename('tsconfig.json', 'tsconfig.base.json');
      await initGenerator(tree, { name: 'myApp' });
      expect(readJson(tree, 'tsconfig.base.json')).toMatchSnapshot();
    });

    it('should update tsconfig.base.json if present', async () => {
      await initGenerator(tree, { name: 'myApp' });
      expect(readJson(tree, 'tsconfig.base.json')).toMatchSnapshot();
    });

    it('should work without nested tsconfig files', async () => {
      await initGenerator(tree, { name: 'myApp' });
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
      await initGenerator(tree, { name: 'myApp' });
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

      await initGenerator(tree, { name: 'myApp' });

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

      await initGenerator(tree, { name: 'myApp' });

      expect(tree.exists('/apps/myApp/tsconfig.app.json')).toBe(true);
      expect(tree.exists('/apps/myApp/karma.conf.js')).toBe(true);

      expect(tree.exists('/karma.conf.js')).toBe(true);
    });

    it('should work with existing .prettierignore file', async () => {
      tree.write('/.prettierignore', '# existing ignore rules');
      await initGenerator(tree, { name: 'myApp' });

      const prettierIgnore = tree.read('/.prettierignore').toString();
      expect(prettierIgnore).toBe('# existing ignore rules');
    });

    it('should update tsconfigs', async () => {
      tree.write('/.prettierignore', '# existing ignore rules');
      await initGenerator(tree, { name: 'myApp' });

      const prettierIgnore = tree.read('/.prettierignore').toString();
      expect(prettierIgnore).toBe('# existing ignore rules');
    });

    it('should work with no root tslint.json', async () => {
      tree.delete('/tslint.json');
      await initGenerator(tree, { name: 'myApp' });

      expect(tree.exists('/tslint.json')).toBe(false);
    });
  });

  describe('preserve angular cli layout', () => {
    beforeEach(() => {
      tree.write('/package.json', JSON.stringify({ devDependencies: {} }));
      tree.write('/angular.json', JSON.stringify({ projects: { myproj: {} } }));
    });

    it('should update package.json', async () => {
      await initGenerator(tree, {
        name: 'myApp',
        preserveAngularCliLayout: true,
      });

      const d = readJson(tree, '/package.json').devDependencies;
      expect(d['@nrwl/workspace']).toBeDefined();
      expect(d['@nrwl/angular']).not.toBeDefined();
    });

    it('should create nx.json', async () => {
      await initGenerator(tree, {
        name: 'myApp',
        preserveAngularCliLayout: true,
      });

      const nxJson = readJson(tree, '/nx.json');
      expect(nxJson.npmScope).toEqual('myproj');
    });

    it('should create decorate-angular-cli.js', async () => {
      await initGenerator(tree, {
        name: 'myApp',
        preserveAngularCliLayout: true,
      });
      const s = readJson(tree, '/package.json').scripts;

      expect(tree.read('/decorate-angular-cli.js')).not.toBe(null);
      expect(s.postinstall).toEqual('node ./decorate-angular-cli.js');
    });
  });
});
