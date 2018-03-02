import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createApp, createEmptyWorkspace } from '../../../../shared/testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';

describe('ngrx', () => {
  const schematicRunner = new SchematicTestRunner('@nrwl/schematics', path.join(__dirname, '../../collection.json'));

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
    appTree = createApp(appTree, 'myapp');
  });

  it('should add empty root', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        onlyEmptyRoot: true
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).toContain('StoreModule.forRoot');
    expect(appModule).toContain('EffectsModule.forRoot');

    expect(tree.exists('apps/myapp/src/app/+state')).toBeFalsy();
  });

  it('should add root', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        root: true
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).toContain('StoreModule.forRoot');
    expect(appModule).toContain('EffectsModule.forRoot');

    expect(tree.exists(`/apps/myapp/src/app/+state/state.actions.ts`)).toBeTruthy();
    expect(tree.exists(`/apps/myapp/src/app/+state/state.effects.ts`)).toBeTruthy();
    expect(tree.exists(`/apps/myapp/src/app/+state/state.effects.spec.ts`)).toBeTruthy();
    expect(tree.exists(`/apps/myapp/src/app/+state/state.init.ts`)).toBeTruthy();
    expect(tree.exists(`/apps/myapp/src/app/+state/state.interfaces.ts`)).toBeTruthy();
    expect(tree.exists(`/apps/myapp/src/app/+state/state.reducer.ts`)).toBeTruthy();
    expect(tree.exists(`/apps/myapp/src/app/+state/state.reducer.spec.ts`)).toBeTruthy();
  });

  it('should add feature', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts'
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).toContain('StoreModule.forFeature');
    expect(appModule).toContain('EffectsModule.forFeature');

    expect(tree.exists(`/apps/myapp/src/app/+state/state.actions.ts`)).toBeTruthy();
  });

  it('should add with custom directoryName', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        directory: 'myCustomState'
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).toContain('StoreModule.forFeature');
    expect(appModule).toContain('EffectsModule.forFeature');

    expect(tree.exists(`/apps/myapp/src/app/myCustomState/state.actions.ts`)).toBeTruthy();
  });

  it('should only add files', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts',
        onlyAddFiles: true
      },
      appTree
    );

    const appModule = getFileContent(tree, '/apps/myapp/src/app/app.module.ts');
    expect(appModule).not.toContain('StoreModule');

    expect(tree.exists(`/apps/myapp/src/app/+state/state.actions.ts`)).toBeTruthy();
  });

  it('should update package.json', () => {
    const tree = schematicRunner.runSchematic(
      'ngrx',
      {
        name: 'state',
        module: 'apps/myapp/src/app/app.module.ts'
      },
      appTree
    );

    const packageJson = JSON.parse(getFileContent(tree, '/package.json'));
    expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
  });

  it('should error when no module is provided', () => {
    expect(() =>
      schematicRunner.runSchematic(
        'ngrx',
        {
          name: 'state'
        },
        appTree
      )
    ).toThrow("should have required property 'module'");
  });
});
