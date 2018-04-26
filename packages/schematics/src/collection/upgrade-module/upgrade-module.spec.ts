import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createApp, createEmptyWorkspace } from '../../utils/testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';
import { readJsonInTree } from '../../utils/ast-utils';

xdescribe('upgrade-module', () => {
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

  it('should update the bootstrap logic', () => {
    const tree = schematicRunner.runSchematic(
      'upgrade-module',
      {
        name: 'legacy'
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).toContain(
      `this.upgrade.bootstrap(document.body, ['downgraded', 'legacy'])`
    );
    expect(appModule).not.toContain(`bootstrap:`);

    const legacySetup = getFileContent(tree, '/apps/myapp/src/legacy-setup.ts');
    expect(legacySetup).toContain(`import 'legacy';`);

    expect(tree.exists('/apps/myapp/src/hybrid.spec.ts')).toBeTruthy();
  });

  it('should update package.json by default', () => {
    appTree.overwrite(
      `/package.json`,
      JSON.stringify({
        dependencies: {
          '@angular/core': '4.4.4'
        }
      })
    );

    const tree = schematicRunner.runSchematic(
      'upgrade-module',
      {
        name: 'legacy'
      },
      appTree
    );

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson.dependencies['@angular/upgrade']).toEqual('4.4.4');
    expect(packageJson.dependencies['angular']).toBeDefined();
  });

  it('should not package.json when --skipPackageJson=true', () => {
    appTree.overwrite(
      `/package.json`,
      JSON.stringify({
        dependencies: {
          '@angular/core': '4.4.4'
        }
      })
    );

    const tree = schematicRunner.runSchematic(
      'upgrade-module',
      {
        name: 'legacy',
        skipPackageJson: true
      },
      appTree
    );

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson.dependencies['@angular/upgrade']).not.toBeDefined();
  });

  it('should add router configuration when --router=true', () => {
    const tree = schematicRunner.runSchematic(
      'upgrade-module',
      {
        name: 'legacy',
        router: true
      },
      appTree
    );

    const legacySetup = getFileContent(tree, '/apps/myapp/src/legacy-setup.ts');
    expect(legacySetup).toContain(`setUpLocationSync`);
  });

  it('should support custom angularJsImport', () => {
    const tree = schematicRunner.runSchematic(
      'upgrade-module',
      {
        name: 'legacy',
        angularJsImport: 'legacy-app'
      },
      appTree
    );

    const legacySetup = getFileContent(tree, '/apps/myapp/src/legacy-setup.ts');
    expect(legacySetup).toContain(`import 'legacy-app';`);
    expect(legacySetup).not.toContain(`import 'legacy';`);
  });
});
