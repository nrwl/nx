import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createApp, createEmptyWorkspace } from '../../utils/testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';
import { readJsonInTree } from '../../utils/ast-utils';

describe('upgrade-module', () => {
  const schematicRunner = new SchematicTestRunner(
    '@nrwl/schematics',
    path.join(__dirname, '../../collection.json')
  );

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
    appTree = createApp(appTree, 'myapp');
  });

  it('should update the bootstrap logic', async () => {
    const tree = await schematicRunner
      .runSchematicAsync(
        'upgrade-module',
        {
          name: 'legacy',
          project: 'myapp'
        },
        appTree
      )
      .toPromise();

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).toContain(
      `this.upgrade.bootstrap(document.body, ['downgraded', 'legacy'])`
    );
    expect(appModule).not.toContain(`bootstrap:`);

    const legacySetup = getFileContent(tree, '/apps/myapp/src/legacy-setup.ts');
    expect(legacySetup).toContain(`import 'legacy';`);

    expect(tree.exists('/apps/myapp/src/hybrid.spec.ts')).toBeTruthy();
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

    const tree = await schematicRunner
      .runSchematicAsync(
        'upgrade-module',
        {
          name: 'legacy',
          project: 'myapp'
        },
        appTree
      )
      .toPromise();

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

    const tree = await schematicRunner
      .runSchematicAsync(
        'upgrade-module',
        {
          name: 'legacy',
          skipPackageJson: true,
          project: 'myapp'
        },
        appTree
      )
      .toPromise();

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson.dependencies['@angular/upgrade']).not.toBeDefined();
  });

  it('should add router configuration when --router=true', async () => {
    const tree = await schematicRunner
      .runSchematicAsync(
        'upgrade-module',
        {
          name: 'legacy',
          router: true,
          project: 'myapp'
        },
        appTree
      )
      .toPromise();

    const legacySetup = getFileContent(tree, '/apps/myapp/src/legacy-setup.ts');
    expect(legacySetup).toContain(`setUpLocationSync`);
  });

  it('should support custom angularJsImport', async () => {
    const tree = await schematicRunner
      .runSchematicAsync(
        'upgrade-module',
        {
          name: 'legacy',
          angularJsImport: 'legacy-app',
          project: 'myapp'
        },
        appTree
      )
      .toPromise();

    const legacySetup = getFileContent(tree, '/apps/myapp/src/legacy-setup.ts');
    expect(legacySetup).toContain(`import 'legacy-app';`);
    expect(legacySetup).not.toContain(`import 'legacy';`);
  });
});
