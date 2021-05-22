import { Tree } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Schema } from '../schema';
import { updateModuleName } from './update-module-name';

const libSchematic = wrapAngularDevkitSchematic('@nrwl/angular', 'lib');

describe('updateModuleName Rule', () => {
  let tree: Tree;
  const schema: Schema = {
    projectName: 'my-source',
    destination: 'my-destination',
    updateImportPath: true,
  };

  const modulePath = '/libs/my-destination/src/lib/my-destination.module.ts';
  const moduleSpecPath =
    '/libs/my-destination/src/lib/my-destination.module.spec.ts';
  const indexPath = '/libs/my-destination/src/index.ts';
  const importerPath = '/libs/my-importer/src/lib/my-importing-file.ts';

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    // fake a mid-move tree:
    await libSchematic(tree, {
      name: 'my-destination',
    });

    tree.write(
      '/libs/my-destination/src/lib/my-source.module.ts',
      `import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';
    
    @NgModule({
      imports: [CommonModule]
    })
    export class MySourceModule {}`
    );

    tree.write(
      '/libs/my-destination/src/lib/my-source.module.spec.ts',
      `import { async, TestBed } from '@angular/core/testing';
    import { MySourceModule } from './my-source.module';
    
    describe('MySourceModule', () => {
      beforeEach(async(() => {
        TestBed.configureTestingModule({
          imports: [MySourceModule]
        }).compileComponents();
      }));
    
      it('should create', () => {
        expect(MySourceModule).toBeDefined();
      });
    });`
    );

    tree.write(
      indexPath,
      `export * from './lib/my-source.module';
    `
    );

    tree.delete(modulePath);
    tree.delete(moduleSpecPath);

    await libSchematic(tree, { name: 'my-importer' });

    tree.write(
      importerPath,
      `import { MySourceModule } from '@proj/my-destination';
    
      export class MyExtendedSourceModule extends MySourceModule {}
      `
    );
  });

  it('should rename the module files and update the module name', async () => {
    await updateModuleName(tree, schema);

    expect(tree.exists(modulePath)).toBe(true);
    expect(tree.exists(moduleSpecPath)).toBe(true);

    const moduleFile = tree.read(modulePath).toString('utf-8');
    expect(moduleFile).toContain(`export class MyDestinationModule {}`);

    const moduleSpecFile = tree.read(moduleSpecPath).toString('utf-8');
    expect(moduleSpecFile).toContain(
      `import { MyDestinationModule } from './my-destination.module';`
    );
    expect(moduleSpecFile).toContain(`describe('MyDestinationModule', () => {`);
    expect(moduleSpecFile).toContain(`imports: [MyDestinationModule]`);
    expect(moduleSpecFile).toContain(
      `expect(MyDestinationModule).toBeDefined();`
    );
  });

  it('should update any references to the module', async () => {
    await updateModuleName(tree, schema);

    const importerFile = tree.read(importerPath).toString('utf-8');
    expect(importerFile).toContain(
      `import { MyDestinationModule } from '@proj/my-destination';`
    );
    expect(importerFile).toContain(
      `export class MyExtendedSourceModule extends MyDestinationModule {}`
    );
  });

  it('should update the index.ts file which exports the module', async () => {
    await updateModuleName(tree, schema);

    const indexFile = tree.read(indexPath).toString('utf-8');
    expect(indexFile).toContain(`export * from './lib/my-destination.module';`);
  });
});
