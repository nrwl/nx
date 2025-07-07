import {
  addProjectConfiguration,
  readProjectConfiguration,
  type Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { AngularProjectConfiguration } from '../../utils/types';
import { componentGenerator } from './component';

describe('component Generator', () => {
  it('should create component files correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', `export * from './lib/lib-module';`);

    // ACT
    await componentGenerator(tree, {
      path: 'libs/lib1/src/lib/example/example',
      standalone: false,
    });

    // ASSERT
    expect(
      tree.read('libs/lib1/src/lib/example/example.ts', 'utf-8')
    ).toMatchSnapshot('component');
    expect(
      tree.read('libs/lib1/src/lib/example/example.html', 'utf-8')
    ).toMatchSnapshot('template');
    expect(
      tree.read('libs/lib1/src/lib/example/example.css', 'utf-8')
    ).toMatchSnapshot('stylesheet');
    expect(
      tree.read('libs/lib1/src/lib/example/example.spec.ts', 'utf-8')
    ).toMatchSnapshot('component test file');
    expect(tree.read('libs/lib1/src/index.ts', 'utf-8')).toMatchSnapshot(
      'entry point file'
    );
  });

  it('should create component files correctly when the type is provided', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });

    await componentGenerator(tree, {
      path: 'libs/lib1/src/lib/example/example',
      type: 'component',
    });

    expect(tree.read('libs/lib1/src/lib/example/example.component.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { Component } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        selector: 'example',
        imports: [CommonModule],
        templateUrl: './example.component.html',
        styleUrl: './example.component.css',
      })
      export class ExampleComponent {}
      "
    `);
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.html', 'utf-8')
    ).toMatchInlineSnapshot(`
      "<p>example works!</p>
      "
    `);
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.css', 'utf-8')
    ).toMatchInlineSnapshot(`""`);
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.spec.ts', 'utf-8')
    ).toMatchInlineSnapshot(`
      "import { ComponentFixture, TestBed } from '@angular/core/testing';
      import { ExampleComponent } from './example.component';

      describe('ExampleComponent', () => {
        let component: ExampleComponent;
        let fixture: ComponentFixture<ExampleComponent>;

        beforeEach(async () => {
          await TestBed.configureTestingModule({
            imports: [ExampleComponent],
          }).compileComponents();

          fixture = TestBed.createComponent(ExampleComponent);
          component = fixture.componentInstance;
          fixture.detectChanges();
        });

        it('should create', () => {
          expect(component).toBeTruthy();
        });
      });
      "
    `);
  });

  it('should use ".ng.html" extension when --ngHtml=true', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });

    await componentGenerator(tree, {
      path: 'libs/lib1/src/lib/example/example',
      ngHtml: true,
    });

    expect(tree.exists('libs/lib1/src/lib/example/example.ng.html')).toBe(true);
    expect(tree.exists('libs/lib1/src/lib/example/example.html')).toBe(false);
    expect(tree.read('libs/lib1/src/lib/example/example.ng.html', 'utf-8'))
      .toMatchInlineSnapshot(`
      "<p>example works!</p>
      "
    `);
    expect(tree.read('libs/lib1/src/lib/example/example.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { Component } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        selector: 'example',
        imports: [CommonModule],
        templateUrl: './example.ng.html',
        styleUrl: './example.css',
      })
      export class Example {}
      "
    `);
  });

  it('should export the component as default when exportDefault is true', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write('libs/lib1/src/index.ts', '');

    await componentGenerator(tree, {
      path: 'libs/lib1/src/lib/example/example',
      exportDefault: true,
    });

    expect(
      tree.read('libs/lib1/src/lib/example/example.ts', 'utf-8')
    ).toContain('export default class Example {}');
    expect(
      tree.read('libs/lib1/src/lib/example/example.spec.ts', 'utf-8')
    ).toContain(`import Example from './example';`);
  });

  it('should handle path with file extension', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'lib1/src',
      root: 'lib1',
    });

    await componentGenerator(tree, {
      path: 'lib1/src/lib/example/example.component.ts',
    });

    expect(
      tree.read('lib1/src/lib/example/example.component.ts', 'utf-8')
    ).toMatchSnapshot('component');
    expect(
      tree.read('lib1/src/lib/example/example.component.html', 'utf-8')
    ).toMatchSnapshot('template');
    expect(
      tree.read('lib1/src/lib/example/example.component.css', 'utf-8')
    ).toMatchSnapshot('stylesheet');
    expect(
      tree.read('lib1/src/lib/example/example.component.spec.ts', 'utf-8')
    ).toMatchSnapshot('component test file');
    expect(tree.read('lib1/src/index.ts', 'utf-8')).toMatchSnapshot(
      'entry point file'
    );
  });

  it('should not generate test file when --skip-tests=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
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
      path: 'libs/lib1/src/lib/example/example',
      skipTests: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('libs/lib1/src/lib/example/example.spec.ts')).toBe(
      false
    );
  });

  it('should inline template when --inline-template=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
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
      path: 'libs/lib1/src/lib/example/example',
      inlineTemplate: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(
      tree.read('libs/lib1/src/lib/example/example.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.exists('libs/lib1/src/lib/example/example.html')).toBe(false);
  });

  it('should inline styles when --inline-style=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
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
      path: 'libs/lib1/src/lib/example/example',
      inlineStyle: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(
      tree.read('libs/lib1/src/lib/example/example.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.exists('libs/lib1/src/lib/example/example.css')).toBe(false);
  });

  it('should not create a style file when --style=none', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
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
      path: 'libs/lib1/src/lib/example/example',
      style: 'none',
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('libs/lib1/src/lib/example/example.none')).toBeFalsy();
    expect(tree.read('libs/lib1/src/lib/example/example.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { Component } from '@angular/core';

      @Component({
        selector: 'example',
        standalone: false,
        templateUrl: './example.html'
      })
      export class Example {}
      "
    `);
  });

  it('should create the component correctly and export it in the entry point when "export=true"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', `export * from './lib/lib-module';`);

    // ACT
    await componentGenerator(tree, {
      path: 'libs/lib1/src/lib/example/example',
      export: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).toMatchSnapshot();
  });

  it('should create the component correctly and export it in the entry point when is standalone and "export=true"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
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
      path: 'libs/lib1/src/lib/example/example',
      export: true,
      skipFormat: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).toMatchInlineSnapshot(
      `"export * from './lib/example/example';"`
    );
  });

  it('should create the component correctly and not export it in the entry point when "export=false"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', `export * from './lib/lib-module';`);

    // ACT
    await componentGenerator(tree, {
      path: 'libs/lib1/src/lib/example/example',
      export: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).not.toContain(`export * from "./lib/example/example";`);
  });

  it('should create the component correctly and not export it in the entry point when is standalone and "export=false"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', `export * from './lib/lib-module';`);

    // ACT
    await componentGenerator(tree, {
      path: 'libs/lib1/src/lib/example/example',
      export: false,
      skipFormat: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).not.toContain(`export * from "./lib/example/example";`);
  });

  it('should create the component correctly and not export it when "--skip-import=true"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', `export * from './lib/lib-module';`);

    // ACT
    await componentGenerator(tree, {
      path: 'libs/lib1/src/lib/example/example',
      skipImport: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).not.toContain(`export * from "./lib/example/example";`);
  });

  it('should create the component correctly but not export it in the entry point when it does not exist', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
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
      path: 'libs/lib1/src/lib/example/example',
      export: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexExists = tree.exists('libs/lib1/src/index.ts');
    expect(indexExists).toBeFalsy();
  });

  it('should not export the component in the entry point when the module it belongs to is not exported', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib-module.ts',
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
      path: 'libs/lib1/src/lib/example/example',
      export: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).toBe('');
  });

  it('should error when the class name is invalid', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });

    await expect(
      componentGenerator(tree, {
        path: 'libs/lib1/src/lib/example/example',
        name: '404',
      })
    ).rejects.toThrow('Class name "404" is invalid.');
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
      'should export it in the entry point when "--module" is set to "%s" and using the "." type separator',
      async (module) => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace();
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
          `export * from './lib/lib.module';`
        );

        // ACT
        await componentGenerator(tree, {
          path: 'libs/lib1/src/lib/example/example',
          module,
          export: true,
          standalone: false,
          skipFormat: true,
        });

        // ASSERT
        const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
        expect(indexSource).toContain(`export * from './lib/example/example';`);
      }
    );

    it.each([
      './lib-module.ts',
      'lib-module.ts',
      './lib-module',
      'lib-module',
      './lib',
      'lib',
    ])(
      'should export it in the entry point when "--module" is set to "%s" and using the "-" type separator',
      async (module) => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'lib1', {
          projectType: 'library',
          sourceRoot: 'libs/lib1/src',
          root: 'libs/lib1',
        });
        tree.write(
          'libs/lib1/src/lib/lib-module.ts',
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
          `export * from './lib/lib-module';`
        );

        // ACT
        await componentGenerator(tree, {
          path: 'libs/lib1/src/lib/example/example',
          module,
          export: true,
          standalone: false,
          skipFormat: true,
        });

        // ASSERT
        const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
        expect(indexSource).toContain(`export * from './lib/example/example';`);
      }
    );

    it('should import the component correctly to the module file when flat is false', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'shared-ui', {
        projectType: 'library',
        sourceRoot: 'libs/shared/ui/src',
        root: 'libs/shared/ui',
      });
      tree.write(
        'libs/shared/ui/src/lib/lib-module.ts',
        `
import { NgModule } from '@angular/core';

@NgModule({
  declarations: [],
  exports: []
})
export class LibModule {}
`
      );
      tree.write(
        'libs/shared/ui/src/index.ts',
        `export * from './lib/lib-module';`
      );

      // ACT
      await componentGenerator(tree, {
        path: 'libs/shared/ui/src/lib/example/example',
        export: true,
        standalone: false,
        skipFormat: true,
      });

      // ASSERT
      const moduleSource = tree.read(
        'libs/shared/ui/src/lib/lib-module.ts',
        'utf-8'
      );
      expect(moduleSource).toMatchSnapshot();
    });

    it('should not export it in the entry point when the module it belong to is not exported', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib-module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write(
        'libs/lib1/src/lib/not-exported-module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class NotExportedModule {}`
      );
      tree.write('libs/lib1/src/index.ts', `export * from './lib/lib-module';`);

      // ACT
      await componentGenerator(tree, {
        path: 'libs/lib1/src/lib/example/example',
        module: 'not-exported',
        export: true,
        standalone: false,
        skipFormat: true,
      });

      // ASSERT
      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).toMatchInlineSnapshot(
        `"export * from './lib/lib-module';"`
      );
    });

    it('should throw an error when the module is not found', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib-module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );

      // ACT & ASSERT
      await expect(
        componentGenerator(tree, {
          path: 'libs/lib1/src/lib/example/example',
          module: 'not-found',
          standalone: false,
          skipFormat: true,
        })
      ).rejects.toThrow();
    });

    it('should throw an error when there are more than one candidate modules that the component can be added to', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib-module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write(
        'libs/lib1/src/lib/lib2-module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class Lib2Module {}`
      );

      // ACT & ASSERT
      await expect(
        componentGenerator(tree, {
          path: 'libs/lib1/src/lib/example/example',
          standalone: false,
          skipFormat: true,
        })
      ).rejects.toThrow();
    });
  });

  describe('prefix & selector', () => {
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        root: 'lib1',
      });
    });

    it('should use the prefix', async () => {
      await componentGenerator(tree, {
        path: 'lib1/src/lib/example/example',
        prefix: 'foo',
      });

      const content = tree.read('lib1/src/lib/example/example.ts', 'utf-8');
      expect(content).toMatch(/selector: 'foo-example'/);
    });

    it('should error when name starts with a digit', async () => {
      await expect(
        componentGenerator(tree, {
          path: 'lib1/src/lib/one/one',
          prefix: '1',
        })
      ).rejects.toThrow('The selector "1-one" is invalid.');
    });

    it('should allow dash in selector before a number', async () => {
      await componentGenerator(tree, {
        path: 'lib1/src/lib/one-1/one-1',
        prefix: 'foo',
      });

      const content = tree.read('lib1/src/lib/one-1/one-1.ts', 'utf-8');
      expect(content).toMatch(/selector: 'foo-one-1'/);
    });

    it('should allow dash in selector before a number and without a prefix', async () => {
      await componentGenerator(tree, {
        path: 'lib1/src/lib/example/example',
        selector: 'one-1',
      });

      const content = tree.read('lib1/src/lib/example/example.ts', 'utf-8');
      expect(content).toMatch(/selector: 'one-1'/);
    });

    it('should use the default project prefix if none is passed', async () => {
      const projectConfig = readProjectConfiguration(tree, 'lib1');
      updateProjectConfiguration(tree, 'lib1', {
        ...projectConfig,
        prefix: 'bar',
      } as AngularProjectConfiguration);

      await componentGenerator(tree, {
        path: 'lib1/src/lib/example/example',
      });

      const content = tree.read('lib1/src/lib/example/example.ts', 'utf-8');
      expect(content).toMatch(/selector: 'bar-example'/);
    });

    it('should not use the default project prefix when supplied prefix is ""', async () => {
      const projectConfig = readProjectConfiguration(tree, 'lib1');
      updateProjectConfiguration(tree, 'lib1', {
        ...projectConfig,
        prefix: '',
      } as AngularProjectConfiguration);

      await componentGenerator(tree, {
        path: 'lib1/src/lib/example/example',
      });

      const content = tree.read('lib1/src/lib/example/example.ts', 'utf-8');
      expect(content).toMatch(/selector: 'example'/);
    });
  });

  describe('secondary entry points', () => {
    it('should create the component correctly and export it in the entry point', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib-module.ts',
        `
      import { NgModule } from '@angular/core';
      
      @NgModule({
        declarations: [],
        exports: []
      })
      export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', `export * from './lib/lib-module';`);

      // secondary entry point
      writeJson(tree, 'libs/lib1/secondary/ng-package.json', {
        lib: { entryFile: './src/index.ts' },
      });
      tree.write(
        'libs/lib1/secondary/src/index.ts',
        `export * from './lib/secondary-module';`
      );
      tree.write(
        'libs/lib1/secondary/src/lib/secondary-module.ts',
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
        path: 'libs/lib1/secondary/src/lib/example/example',
        export: true,
        standalone: false,
        skipFormat: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/secondary/src/lib/example/example.ts',
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
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib-module.ts',
        `
      import { NgModule } from '@angular/core';
      
      @NgModule({
        declarations: [],
        exports: []
      })
      export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', `export * from './lib/lib-module';`);

      // secondary entry point
      writeJson(tree, 'libs/lib1/secondary/ng-package.json', {
        lib: { entryFile: './src/index.ts' },
      });
      tree.write('libs/lib1/secondary/src/index.ts', '');
      tree.write(
        'libs/lib1/secondary/src/lib/secondary-module.ts',
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
        path: 'libs/lib1/secondary/src/lib/example',
        export: true,
        standalone: false,
        skipFormat: true,
      });

      // ASSERT
      const indexSource = tree.read(
        'libs/lib1/secondary/src/index.ts',
        'utf-8'
      );
      expect(indexSource).toBe('');
    });
  });

  describe('compat', () => {
    it('should generate files with the "component" type for versions below v20', async () => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '~19.2.0';
        return json;
      });
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });

      await componentGenerator(tree, {
        path: 'libs/lib1/src/lib/example/example',
      });

      expect(
        tree.read('libs/lib1/src/lib/example/example.component.ts', 'utf-8')
      ).toMatchInlineSnapshot(`
        "import { Component } from '@angular/core';
        import { CommonModule } from '@angular/common';

        @Component({
          selector: 'example',
          imports: [CommonModule],
          templateUrl: './example.component.html',
          styleUrl: './example.component.css',
        })
        export class ExampleComponent {}
        "
      `);
      expect(
        tree.read('libs/lib1/src/lib/example/example.component.html', 'utf-8')
      ).toMatchInlineSnapshot(`
        "<p>example works!</p>
        "
      `);
      expect(
        tree.read('libs/lib1/src/lib/example/example.component.css', 'utf-8')
      ).toMatchInlineSnapshot(`""`);
      expect(
        tree.read(
          'libs/lib1/src/lib/example/example.component.spec.ts',
          'utf-8'
        )
      ).toMatchInlineSnapshot(`
        "import { ComponentFixture, TestBed } from '@angular/core/testing';
        import { ExampleComponent } from './example.component';

        describe('ExampleComponent', () => {
          let component: ExampleComponent;
          let fixture: ComponentFixture<ExampleComponent>;

          beforeEach(async () => {
            await TestBed.configureTestingModule({
              imports: [ExampleComponent],
            }).compileComponents();

            fixture = TestBed.createComponent(ExampleComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
          });

          it('should create', () => {
            expect(component).toBeTruthy();
          });
        });
        "
      `);
    });
  });
});
