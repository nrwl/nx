import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '../../utils/testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';
import * as stripJsonComments from 'strip-json-comments';
import { readJsonInTree } from '../../utils/ast-utils';

describe('app', () => {
  const schematicRunner = new SchematicTestRunner(
    '@nrwl/schematics',
    path.join(__dirname, '../../collection.json')
  );

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('not nested', () => {
    it('should update angular.json', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp' },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');

      expect(angularJson.projects['my-app'].root).toEqual('apps/my-app/');
      expect(angularJson.projects['my-app-e2e'].root).toEqual(
        'apps/my-app-e2e/'
      );
    });

    it('should update nx.json', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-app': {
            tags: ['one', 'two']
          },
          'my-app-e2e': {
            tags: []
          }
        }
      });
    });

    it('should generate files', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp' },
        appTree
      );
      expect(tree.exists(`apps/my-app/karma.conf.js`)).toBeTruthy();
      expect(tree.exists('apps/my-app/src/main.ts')).toBeTruthy();
      expect(tree.exists('apps/my-app/src/app/app.module.ts')).toBeTruthy();
      expect(tree.exists('apps/my-app/src/app/app.component.ts')).toBeTruthy();
      expect(
        getFileContent(tree, 'apps/my-app/src/app/app.module.ts')
      ).toContain('class AppModule');

      const tsconfigApp = JSON.parse(
        stripJsonComments(getFileContent(tree, 'apps/my-app/tsconfig.app.json'))
      );
      expect(tsconfigApp.compilerOptions.outDir).toEqual(
        '../../dist/out-tsc/apps/my-app'
      );
      expect(tsconfigApp.extends).toEqual('../../tsconfig.json');

      const tslintJson = JSON.parse(
        stripJsonComments(getFileContent(tree, 'apps/my-app/tslint.json'))
      );
      expect(tslintJson.extends).toEqual('../../tslint.json');

      expect(tree.exists('apps/my-app-e2e/src/app.po.ts')).toBeTruthy();
      const tsconfigE2E = JSON.parse(
        stripJsonComments(
          getFileContent(tree, 'apps/my-app-e2e/tsconfig.e2e.json')
        )
      );
      expect(tsconfigE2E.compilerOptions.outDir).toEqual(
        '../../dist/out-tsc/apps/my-app-e2e'
      );
      expect(tsconfigE2E.extends).toEqual('../../tsconfig.json');
    });

    it('should default the prefix to npmScope', () => {
      const noPrefix = schematicRunner.runSchematic(
        'app',
        { name: 'myApp' },
        appTree
      );
      const withPrefix = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', prefix: 'custom' },
        appTree
      );

      // Testing without prefix

      let appE2eSpec = noPrefix
        .read('apps/my-app-e2e/src/app.e2e-spec.ts')
        .toString();
      let angularJson = JSON.parse(noPrefix.read('angular.json').toString());
      let myAppPrefix = angularJson.projects['my-app'].prefix;

      expect(myAppPrefix).toEqual('proj');
      expect(appE2eSpec).toContain('Welcome to my-app!');

      // Testing WITH prefix

      appE2eSpec = withPrefix
        .read('apps/my-app-e2e/src/app.e2e-spec.ts')
        .toString();
      angularJson = JSON.parse(withPrefix.read('angular.json').toString());
      myAppPrefix = angularJson.projects['my-app'].prefix;

      expect(myAppPrefix).toEqual('custom');
      expect(appE2eSpec).toContain('Welcome to my-app!');
    });
  });

  describe('not nested, with nested e2e', () => {
    it('should update angular.json', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', nestE2e: true },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');

      expect(angularJson.projects['my-app'].root).toEqual('apps/my-app/');
      expect(angularJson.projects['my-app-e2e'].root).toEqual(
        'apps/my-app/e2e/'
      );
    });

    it('should update nx.json', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-app': {
            tags: ['one', 'two']
          },
          'my-app-e2e': {
            tags: []
          }
        }
      });
    });

    it('should generate files', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', nestE2e: true },
        appTree
      );
      expect(tree.exists(`apps/my-app/karma.conf.js`)).toBeTruthy();
      expect(tree.exists('apps/my-app/src/main.ts')).toBeTruthy();
      expect(tree.exists('apps/my-app/src/app/app.module.ts')).toBeTruthy();
      expect(tree.exists('apps/my-app/src/app/app.component.ts')).toBeTruthy();
      expect(
        getFileContent(tree, 'apps/my-app/src/app/app.module.ts')
      ).toContain('class AppModule');

      const tsconfigApp = JSON.parse(
        stripJsonComments(getFileContent(tree, 'apps/my-app/tsconfig.app.json'))
      );
      expect(tsconfigApp.compilerOptions.outDir).toEqual(
        '../../dist/out-tsc/apps/my-app'
      );
      expect(tsconfigApp.extends).toEqual('../../tsconfig.json');

      const tslintJson = JSON.parse(
        stripJsonComments(getFileContent(tree, 'apps/my-app/tslint.json'))
      );
      expect(tslintJson.extends).toEqual('../../tslint.json');

      expect(tree.exists('apps/my-app/e2e/src/app.po.ts')).toBeTruthy();

      // check e2e spec file patching was successful
      const e2eSpec = getFileContent(
        tree,
        'apps/my-app/e2e/src/app.e2e-spec.ts'
      );
      expect(e2eSpec.indexOf('<any>')).toBeGreaterThan(-1);
      expect(e2eSpec.indexOf('jasmine')).toBeGreaterThan(-1);

      const tsconfigE2E = JSON.parse(
        stripJsonComments(
          getFileContent(tree, 'apps/my-app/e2e/tsconfig.e2e.json')
        )
      );
      expect(tsconfigE2E.compilerOptions.outDir).toEqual(
        '../../../dist/out-tsc/apps/my-app-e2e'
      );
      expect(tsconfigE2E.extends).toEqual('../../../tsconfig.json');
    });

    it('should default the prefix to npmScope', () => {
      const noPrefix = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', nestE2e: true },
        appTree
      );
      const withPrefix = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', prefix: 'custom', nestE2e: true },
        appTree
      );

      // Testing without prefix

      let appE2eSpec = noPrefix
        .read('apps/my-app/e2e/src/app.e2e-spec.ts')
        .toString();
      let angularJson = JSON.parse(noPrefix.read('angular.json').toString());
      let myAppPrefix = angularJson.projects['my-app'].prefix;

      expect(myAppPrefix).toEqual('proj');
      expect(appE2eSpec).toContain('Welcome to my-app!');

      // Testing WITH prefix

      appE2eSpec = withPrefix
        .read('apps/my-app/e2e/src/app.e2e-spec.ts')
        .toString();
      angularJson = JSON.parse(withPrefix.read('angular.json').toString());
      myAppPrefix = angularJson.projects['my-app'].prefix;

      expect(myAppPrefix).toEqual('custom');
      expect(appE2eSpec).toContain('Welcome to my-app!');
    });
  });

  describe('nested', () => {
    it('should update angular.json', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', directory: 'myDir' },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');

      expect(angularJson.projects['my-dir-my-app'].root).toEqual(
        'apps/my-dir/my-app/'
      );
      expect(angularJson.projects['my-dir-my-app-e2e'].root).toEqual(
        'apps/my-dir/my-app-e2e/'
      );
    });

    it('should update nx.json', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', directory: 'myDir', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-dir-my-app': {
            tags: ['one', 'two']
          },
          'my-dir-my-app-e2e': {
            tags: []
          }
        }
      });
    });

    it('should generate files', () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const content = getFileContent(tree, path);
        const config = JSON.parse(stripJsonComments(content));

        expect(lookupFn(config)).toEqual(expectedValue);
      };
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', directory: 'myDir' },
        appTree
      );

      const appModulePath = 'apps/my-dir/my-app/src/app/app.module.ts';
      expect(getFileContent(tree, appModulePath)).toContain('class AppModule');

      // Make sure these exist
      [
        `apps/my-dir/my-app/karma.conf.js`,
        'apps/my-dir/my-app/src/main.ts',
        'apps/my-dir/my-app/src/app/app.module.ts',
        'apps/my-dir/my-app/src/app/app.component.ts',
        'apps/my-dir/my-app-e2e/src/app.po.ts'
      ].forEach(path => {
        expect(tree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'apps/my-dir/my-app/tsconfig.app.json',
          lookupFn: json => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc/apps/my-dir/my-app'
        },
        {
          path: 'apps/my-dir/my-app-e2e/tsconfig.e2e.json',
          lookupFn: json => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc/apps/my-dir/my-app-e2e'
        },
        {
          path: 'apps/my-dir/my-app/tslint.json',
          lookupFn: json => json.extends,
          expectedValue: '../../../tslint.json'
        }
      ].forEach(hasJsonValue);
    });
  });

  describe('nested, with nested e2e', () => {
    it('should update angular.json', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', directory: 'myDir', nestE2e: true },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');

      expect(angularJson.projects['my-dir-my-app'].root).toEqual(
        'apps/my-dir/my-app/'
      );
      expect(angularJson.projects['my-dir-my-app-e2e'].root).toEqual(
        'apps/my-dir/my-app/e2e/'
      );
    });

    it('should update nx.json', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', directory: 'myDir', tags: 'one,two', nestE2e: true },
        appTree
      );
      const nxJson = readJsonInTree(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-dir-my-app': {
            tags: ['one', 'two']
          },
          'my-dir-my-app-e2e': {
            tags: []
          }
        }
      });
    });

    it('should generate files', () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const content = getFileContent(tree, path);
        const config = JSON.parse(stripJsonComments(content));

        expect(lookupFn(config)).toEqual(expectedValue);
      };
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', directory: 'myDir', nestE2e: true },
        appTree
      );

      const appModulePath = 'apps/my-dir/my-app/src/app/app.module.ts';
      expect(getFileContent(tree, appModulePath)).toContain('class AppModule');

      // Make sure these exist
      [
        `apps/my-dir/my-app/karma.conf.js`,
        'apps/my-dir/my-app/src/main.ts',
        'apps/my-dir/my-app/src/app/app.module.ts',
        'apps/my-dir/my-app/src/app/app.component.ts',
        'apps/my-dir/my-app/e2e/src/app.po.ts'
      ].forEach(path => {
        expect(tree.exists(path)).toBeTruthy();
      });

      // check e2e spec file patching was successful
      const e2eSpec = getFileContent(
        tree,
        'apps/my-dir/my-app/e2e/src/app.e2e-spec.ts'
      );
      expect(e2eSpec.indexOf('<any>')).toBeGreaterThan(-1);
      expect(e2eSpec.indexOf('jasmine')).toBeGreaterThan(-1);

      // Make sure these have properties
      [
        {
          path: 'apps/my-dir/my-app/tsconfig.app.json',
          lookupFn: json => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc/apps/my-dir/my-app'
        },
        {
          path: 'apps/my-dir/my-app/e2e/tsconfig.e2e.json',
          lookupFn: json => json.compilerOptions.outDir,
          expectedValue: '../../../../dist/out-tsc/apps/my-dir/my-app-e2e'
        },
        {
          path: 'apps/my-dir/my-app/tslint.json',
          lookupFn: json => json.extends,
          expectedValue: '../../../tslint.json'
        }
      ].forEach(hasJsonValue);
    });
  });

  it('should import NgModule', () => {
    const tree = schematicRunner.runSchematic(
      'app',
      { name: 'myApp', directory: 'myDir' },
      appTree
    );
    expect(
      getFileContent(tree, 'apps/my-dir/my-app/src/app/app.module.ts')
    ).toContain('NxModule.forRoot()');
  });

  describe('routing', () => {
    it('should include RouterTestingModule', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', directory: 'myDir', routing: true },
        appTree
      );
      expect(
        getFileContent(tree, 'apps/my-dir/my-app/src/app/app.module.ts')
      ).toContain('RouterModule.forRoot');
      expect(
        getFileContent(tree, 'apps/my-dir/my-app/src/app/app.component.spec.ts')
      ).toContain('imports: [RouterTestingModule]');
    });
  });

  describe('template generation mode', () => {
    it('should create Nx specific `app.component.html` template', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', directory: 'myDir' },
        appTree
      );
      expect(
        getFileContent(tree, 'apps/my-dir/my-app/src/app/app.component.html')
      ).toBeTruthy();
      expect(
        getFileContent(tree, 'apps/my-dir/my-app/src/app/app.component.html')
      ).toContain('This is an Angular CLI app built with Nrwl Nx!');
    });

    it("should update `template`'s property of AppComponent with Nx content", () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', directory: 'myDir', inlineTemplate: true },
        appTree
      );
      expect(
        getFileContent(tree, 'apps/my-dir/my-app/src/app/app.component.ts')
      ).toContain('This is an Angular CLI app built with Nrwl Nx!');
    });
  });
});
