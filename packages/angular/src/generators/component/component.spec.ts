import { addProjectConfiguration, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import componentGenerator from './component';

describe('component Generator', () => {
  it('should create the component correctly and export it in the entry point when "export=true"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).toMatchSnapshot();
  });

  it('should create the component correctly and export it in the entry point when is standalone and "export=true"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      standalone: true,
      export: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).toMatchInlineSnapshot(
      `"export * from \\"./lib/example/example.component\\";"`
    );
  });

  it('should create the component correctly and not export it in the entry point when "export=false"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: false,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).not.toContain(
      `export * from "./lib/example/example.component";`
    );
  });

  it('should create the component correctly and not export it in the entry point when is standalone and "export=false"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      standalone: true,
      export: false,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).not.toContain(
      `export * from "./lib/example/example.component";`
    );
  });

  it('should create the component correctly and not export it when "--skip-import=true"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      skipImport: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).not.toContain(
      `export * from "./lib/example/example.component";`
    );
  });

  it('should create the component correctly but not export it in the entry point when it does not exist', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexExists = tree.exists('libs/lib1/src/index.ts');
    expect(indexExists).toBeFalsy();
  });

  it('should not export the component in the entry point when the module it belongs to is not exported', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: true,
    });

    // ASSERT
    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).toBe('');
  });

  describe('--flat', () => {
    it('should create the component correctly and export it in the entry point', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        flat: true,
        export: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/src/lib/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchSnapshot();

      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).toContain(`export * from "./lib/example.component";`);
    });

    it('should create the component correctly and not export it when "export=false"', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        flat: true,
        export: false,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/src/lib/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchSnapshot();

      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).not.toContain(
        `export * from "./lib/example.component";`
      );
    });
  });

  describe('--path', () => {
    it('should create the component correctly and export it in the entry point', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        path: 'libs/lib1/src/lib/mycomp',
        export: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/src/lib/mycomp/example/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchSnapshot();

      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).toContain(
        `export * from "./lib/mycomp/example/example.component";`
      );
    });

    it('should throw if the path specified is not under the project root', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // ACT & ASSERT
      await expect(
        componentGenerator(tree, {
          name: 'example',
          project: 'lib1',
          path: 'apps/app1/src/mycomp',
          export: false,
        })
      ).rejects.toThrow();
    });
  });

  describe('--module', () => {
    it.each([
      './lib.module.ts',
      'lib.module.ts',
      './lib.module',
      'lib.module',
      './lib',
      'lib',
    ])(
      'should export it in the entry point when "--module" is set to "%s"',
      async (module) => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace(2);
        addProjectConfiguration(tree, 'lib1', {
          projectType: 'library',
          sourceRoot: 'libs/lib1/src',
          root: 'libs/lib1',
        });
        tree.write(
          'libs/lib1/src/lib/lib.module.ts',
          `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
        );
        tree.write(
          'libs/lib1/src/index.ts',
          'export * from "./lib/lib.module";'
        );

        // ACT
        await componentGenerator(tree, {
          name: 'example',
          project: 'lib1',
          module,
          export: true,
        });

        // ASSERT
        const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
        expect(indexSource).toContain(
          `export * from "./lib/example/example.component";`
        );
      }
    );

    it('should not export it in the entry point when the module it belong to is not exported', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write(
        'libs/lib1/src/lib/not-exported.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class NotExportedModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        module: 'not-exported',
        export: true,
      });

      // ASSERT
      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).toMatchInlineSnapshot(
        `"export * from \\"./lib/lib.module\\";"`
      );
    });
  });

  describe('secondary entry points', () => {
    it('should create the component correctly and export it in the entry point', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
      import { NgModule } from '@angular/core';
      
      @NgModule({
        declarations: [],
        exports: []
      })
      export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // secondary entry point
      writeJson(tree, 'libs/lib1/secondary/ng-package.json', {
        lib: { entryFile: './src/index.ts' },
      });
      tree.write(
        'libs/lib1/secondary/src/index.ts',
        'export * from "./lib/secondary.module";'
      );
      tree.write(
        'libs/lib1/secondary/src/lib/secondary.module.ts',
        `
      import { NgModule } from '@angular/core';
      
      @NgModule({
        declarations: [],
        exports: []
      })
      export class SecondaryModule {}`
      );

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        path: 'libs/lib1/secondary/src/lib',
        export: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/secondary/src/lib/example/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchSnapshot();

      const secondaryIndexSource = tree.read(
        'libs/lib1/secondary/src/index.ts',
        'utf-8'
      );
      expect(secondaryIndexSource).toMatchSnapshot();
    });

    it('should not export the component in the entry point when the module it belongs to is not exported', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
      import { NgModule } from '@angular/core';
      
      @NgModule({
        declarations: [],
        exports: []
      })
      export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // secondary entry point
      writeJson(tree, 'libs/lib1/secondary/ng-package.json', {
        lib: { entryFile: './src/index.ts' },
      });
      tree.write('libs/lib1/secondary/src/index.ts', '');
      tree.write(
        'libs/lib1/secondary/src/lib/secondary.module.ts',
        `
      import { NgModule } from '@angular/core';
      
      @NgModule({
        declarations: [],
        exports: []
      })
      export class SecondaryModule {}`
      );

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        export: true,
      });

      // ASSERT
      const indexSource = tree.read(
        'libs/lib1/secondary/src/index.ts',
        'utf-8'
      );
      expect(indexSource).toBe('');
    });
  });
});
