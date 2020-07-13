import { Tree } from '@angular-devkit/schematics';
import { runSchematic } from '../../utils/testing';
import { UnitTestTree } from '@angular-devkit/schematics/testing';

describe('workspace', () => {
  let appTree: UnitTestTree;

  beforeEach(() => {
    appTree = new UnitTestTree(Tree.empty());
  });

  describe('move to nx layout', () => {
    it('should error if no package.json is present', async () => {
      try {
        await runSchematic('ng-add', { name: 'myApp' }, appTree);
        fail('should throw');
      } catch (e) {
        expect(e.message).toContain('Cannot find package.json');
      }
    });

    it('should error if no e2e/protractor.conf.js is present', async () => {
      appTree.create('/package.json', JSON.stringify({}));
      appTree.create(
        '/angular.json',
        JSON.stringify({
          projects: {
            proj1: {
              architect: {
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

      try {
        await runSchematic('ng-add', { name: 'proj1' }, appTree);
      } catch (e) {
        expect(e.message).toContain(
          'An e2e project was specified but e2e/protractor.conf.js could not be found.'
        );
      }
    });

    it('should error if no angular.json is present', async () => {
      try {
        appTree.create('/package.json', JSON.stringify({}));
        appTree.create('/e2e/protractor.conf.js', '');
        await runSchematic('ng-add', { name: 'myApp' }, appTree);
      } catch (e) {
        expect(e.message).toContain('Cannot find angular.json');
      }
    });

    it('should error if the angular.json specifies more than one app', async () => {
      appTree.create('/package.json', JSON.stringify({}));
      appTree.create('/e2e/protractor.conf.js', '');
      appTree.create(
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
        await runSchematic('ng-add', { name: 'myApp' }, appTree);
      } catch (e) {
        expect(e.message).toContain('Can only convert projects with one app');
      }
    });

    it('should work without nested tsconfig files', async () => {
      appTree.create('/package.json', JSON.stringify({}));
      appTree.create(
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
                  options: {
                    protractorConfig: 'e2e/protractor.conf.js',
                  },
                },
              },
            },
          },
        })
      );
      appTree.create(
        '/tsconfig.app.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      appTree.create(
        '/tsconfig.spec.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      appTree.create('/tsconfig.base.json', '{"compilerOptions": {}}');
      appTree.create('/tslint.json', '{"rules": {}}');
      appTree.create('/e2e/protractor.conf.js', '// content');
      appTree.create('/src/app/app.module.ts', '// content');
      const tree = await runSchematic('ng-add', { name: 'myApp' }, appTree);
      expect(tree.exists('/apps/myApp/tsconfig.app.json')).toBe(true);
    });

    it('should work with nested (sub-dir) tsconfig files', async () => {
      appTree.create('/package.json', JSON.stringify({}));
      appTree.create(
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
      appTree.create(
        '/src/tsconfig.app.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      appTree.create(
        '/src/tsconfig.spec.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      appTree.create('/tsconfig.base.json', '{"compilerOptions": {}}');
      appTree.create('/tslint.json', '{"rules": {}}');
      appTree.create('/e2e/protractor.conf.js', '// content');
      appTree.create('/src/app/app.module.ts', '// content');
      const tree = await runSchematic('ng-add', { name: 'myApp' }, appTree);
      expect(tree.exists('/apps/myApp/tsconfig.app.json')).toBe(true);
    });

    it('should work with missing e2e, lint, or test targets', async () => {
      appTree.create('/package.json', JSON.stringify({}));
      appTree.create(
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
      appTree.create(
        '/tsconfig.app.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      appTree.create(
        '/tsconfig.spec.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      appTree.create('/tsconfig.base.json', '{"compilerOptions": {}}');
      appTree.create('/tslint.json', '{"rules": {}}');
      appTree.create('/e2e/protractor.conf.js', '// content');
      appTree.create('/src/app/app.module.ts', '// content');
      appTree.create('/karma.conf.js', '// content');

      const tree = await runSchematic('ng-add', { name: 'myApp' }, appTree);

      expect(tree.exists('/apps/myApp/tsconfig.app.json')).toBe(true);
      expect(tree.exists('/apps/myApp/karma.conf.js')).toBe(true);
      expect(tree.exists('/karma.conf.js')).toBe(true);
    });

    it('should work with existing .prettierignore file', async () => {
      appTree.create('/package.json', JSON.stringify({}));
      appTree.create('/.prettierignore', '# existing ignore rules');
      appTree.create(
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
                  options: {
                    protractorConfig: 'e2e/protractor.conf.js',
                  },
                },
              },
            },
          },
        })
      );
      appTree.create(
        '/tsconfig.app.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      appTree.create(
        '/tsconfig.spec.json',
        '{"extends": "../tsconfig.json", "compilerOptions": {}}'
      );
      appTree.create('/tsconfig.base.json', '{"compilerOptions": {}}');
      appTree.create('/tslint.json', '{"rules": {}}');
      appTree.create('/e2e/protractor.conf.js', '// content');
      appTree.create('/src/app/app.module.ts', '// content');
      const tree = await runSchematic('ng-add', { name: 'myApp' }, appTree);

      const prettierIgnore = tree.read('/.prettierignore').toString();
      expect(prettierIgnore).toBe('# existing ignore rules');
    });
  });

  describe('preserve angular cli layout', () => {
    beforeEach(() => {
      appTree.create('/package.json', JSON.stringify({ devDependencies: {} }));
      appTree.create(
        '/angular.json',
        JSON.stringify({ projects: { myproj: {} } })
      );
    });

    it('should update package.json', async () => {
      const tree = await runSchematic(
        'ng-add',
        { preserveAngularCLILayout: true },
        appTree
      );

      const d = JSON.parse(tree.readContent('/package.json')).devDependencies;
      expect(d['@nrwl/workspace']).toBeDefined();
      expect(d['@nrwl/angular']).not.toBeDefined();
    });

    it('should create nx.json', async () => {
      const tree = await runSchematic(
        'ng-add',
        { preserveAngularCLILayout: true },
        appTree
      );

      const nxJson = JSON.parse(tree.readContent('/nx.json'));
      expect(nxJson.projects).toEqual({ myproj: { tags: [] } });
      expect(nxJson.npmScope).toEqual('myproj');
    });

    it('should create decorate-angular-cli.js', async () => {
      const tree = await runSchematic(
        'ng-add',
        { preserveAngularCLILayout: true },
        appTree
      );
      const s = JSON.parse(tree.readContent('/package.json')).scripts;

      expect(tree.read('/decorate-angular-cli.js')).not.toBe(null);
      expect(s.postinstall).toEqual('node ./decorate-angular-cli.js');
    });
  });
});
