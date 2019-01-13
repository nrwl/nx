import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import {
  createApp,
  createEmptyWorkspace,
  runSchematic
} from '../../utils/testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';
import { readJsonInTree } from '../../utils/ast-utils';

describe('downgrade-module', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
    appTree = createApp(appTree, 'myapp');
  });

  it('should update main.ts', async () => {
    const tree = await runSchematic(
      'downgrade-module',
      {
        name: 'legacy',
        project: 'myapp'
      },
      appTree
    );

    const main = getFileContent(tree, '/apps/myapp/src/main.ts');
    expect(main).toContain('downgradeModule(bootstrapAngular)');
    expect(main).toContain(`import 'legacy';`);
    expect(main).toContain(
      `angular.bootstrap(document, ['legacy', downgraded.name]);`
    );
  });

  it('should update module', async () => {
    const tree = await runSchematic(
      'downgrade-module',
      {
        name: 'legacy',
        project: 'myapp'
      },
      appTree
    );

    const appModule = getFileContent(tree, 'apps/myapp/src/app/app.module.ts');
    expect(appModule).not.toContain('bootstrap:');
    expect(appModule).toContain('entryComponents: [AppComponent]');
    expect(appModule).toContain('ngDoBootstrap');
  });

  it('should update package.json by default', async () => {
    appTree.overwrite(
      `/package.json`,
      JSON.stringify({
        dependencies: {
          '@angular/core': '4.4.4'
        }
      })
    );

    const tree = await runSchematic(
      'downgrade-module',
      {
        name: 'legacy',
        project: 'myapp'
      },
      appTree
    );

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson.dependencies['@angular/upgrade']).toEqual('4.4.4');
    expect(packageJson.dependencies['angular']).toBeDefined();
  });

  it('should not package.json when --skipPackageJson=true', async () => {
    appTree.overwrite(
      `/package.json`,
      JSON.stringify({
        dependencies: {
          '@angular/core': '4.4.4'
        }
      })
    );

    const tree = await runSchematic(
      'downgrade-module',
      {
        name: 'legacy',
        skipPackageJson: true,
        project: 'myapp'
      },
      appTree
    );

    const packageJson = readJsonInTree(tree, 'package.json');
    expect(packageJson.dependencies['@angular/upgrade']).not.toBeDefined();
  });

  it('should support custom angularJsImport', async () => {
    const tree = await runSchematic(
      'downgrade-module',
      {
        name: 'legacy',
        angularJsImport: 'legacy-app',
        project: 'myapp'
      },
      appTree
    );

    const main = getFileContent(tree, '/apps/myapp/src/main.ts');
    expect(main).toContain(`import 'legacy-app';`);
    expect(main).not.toContain(`import 'legacy';`);
  });
});
