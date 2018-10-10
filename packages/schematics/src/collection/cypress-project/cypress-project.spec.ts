import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/schematics/src/utils/testing-utils';
import { readJsonInTree } from '@nrwl/schematics/src/utils/ast-utils';
import * as path from 'path';

describe('schematic:cypres-project', () => {
  const schematicRunner = new SchematicTestRunner(
    '@nrwl/schematics',
    path.join(__dirname, '../../collection.json')
  );

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('generate app --e2e-test-runner=cypress', () => {
    it('should not contain any protractor files', () => {
      const tree = schematicRunner.runSchematic(
        'application',
        { name: 'myApp', e2eTestRunner: 'cypress' },
        appTree
      );

      expect(
        tree.exists('apps/my-app-e2e/protractor.e2e.json')
      ).not.toBeTruthy();
      expect(
        tree.exists('apps/my-app-e2e/protractor.conf.js')
      ).not.toBeTruthy();

      expect(
        tree.exists('apps/my-app-e2e/src/app.e2e-spec.ts')
      ).not.toBeTruthy();
      expect(tree.exists('apps/my-app-e2e/src/app.po.ts')).not.toBeTruthy();
    });

    it('should generate files', () => {
      const tree = schematicRunner.runSchematic(
        'application',
        { name: 'myApp', e2eTestRunner: 'cypress' },
        appTree
      );

      expect(tree.exists('apps/my-app-e2e/cypress.json')).toBeTruthy();
      expect(tree.exists('apps/my-app-e2e/tsconfig.json')).toBeTruthy();

      expect(
        tree.exists('apps/my-app-e2e/cypress/support/commands.ts')
      ).toBeTruthy();
      expect(
        tree.exists('apps/my-app-e2e/cypress/support/index.ts')
      ).toBeTruthy();

      expect(
        tree.exists('apps/my-app-e2e/src/fixtures/example.json')
      ).toBeTruthy();
      expect(
        tree.exists('apps/my-app-e2e/src/integration/app.spec.ts')
      ).toBeTruthy();
      expect(tree.exists('apps/my-app-e2e/src/plugins/index.ts')).toBeTruthy();
      expect(tree.exists('apps/my-app-e2e/src/support/app.po.ts')).toBeTruthy();
    });

    it('should add dependencies into `package.json` file', () => {
      const tree = schematicRunner.runSchematic(
        'application',
        { name: 'myApp', e2eTestRunner: 'cypress' },
        appTree
      );
      const packageJson = readJsonInTree(tree, 'package.json');

      expect(packageJson.devDependencies.cypress).toBeDefined();
      expect(packageJson.devDependencies['@nrwl/builders']).toBeDefined();
    });

    it('should add update `angular.json` file', () => {
      const tree = schematicRunner.runSchematic(
        'application',
        { name: 'myApp', e2eTestRunner: 'cypress' },
        appTree
      );
      const angularJson = readJsonInTree(tree, 'angular.json');

      expect(angularJson.projects['my-app-e2e'].root).toEqual(
        'apps/my-app-e2e/'
      );
    });

    it('should set right path names in `cypress.json`', () => {
      const tree = schematicRunner.runSchematic(
        'application',
        { name: 'myApp', e2eTestRunner: 'cypress' },
        appTree
      );
      const cypressJson = readJsonInTree(tree, 'apps/my-app-e2e/cypress.json');

      expect(cypressJson).toEqual({
        fileServerFolder: '../../dist/apps/my-app-e2e',
        fixturesFolder: '../../dist/apps/my-app-e2e/src/fixtures',
        integrationFolder: '../../dist/apps/my-app-e2e/src/integration',
        pluginsFile: '../../dist/apps/my-app-e2e/src/plugins/index.js',
        video: true,
        videosFolder: '../../dist/apps/my-app-e2e/videos',
        screenshotsFolder: '../../dist/apps/my-app-e2e/screenshots',
        chromeWebSecurity: false
      });
    });

    it('should set right path names in `tsconfig.json`', () => {
      const tree = schematicRunner.runSchematic(
        'application',
        { name: 'myApp', e2eTestRunner: 'cypress' },
        appTree
      );
      const tsconfigJson = readJsonInTree(
        tree,
        'apps/my-app-e2e/tsconfig.json'
      );

      expect(tsconfigJson.compilerOptions.outDir).toEqual(
        '../../dist/apps/my-app-e2e'
      );
    });
  });
});
