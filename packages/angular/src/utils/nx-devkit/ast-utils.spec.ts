import {
  addImportToComponent,
  addImportToDirective,
  addImportToModule,
  addImportToPipe,
  addProviderToAppConfig,
  addProviderToBootstrapApplication,
  isStandalone,
} from './ast-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createSourceFile, ScriptTarget } from 'typescript';

describe('Angular AST Utils', () => {
  it('should correctly add the imported symbol to the NgModule', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    const pathToModule = `my.module.ts`;
    const originalContents = `import { NgModule } from '@angular/core';
    
    @NgModule({})
    export class MyModule {}
    `;

    tree.write(pathToModule, originalContents);

    const symbolToAdd = `CommonModule`;

    const sourceText = tree.read(pathToModule, 'utf-8');
    const tsSourceFile = createSourceFile(
      pathToModule,
      sourceText,
      ScriptTarget.Latest,
      true
    );

    // ACT
    addImportToModule(tree, tsSourceFile, pathToModule, symbolToAdd);

    // ASSERT
    expect(tree.read(pathToModule, 'utf-8')).toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
          
          @NgModule({  imports: [CommonModule]
      })
          export class MyModule {}
          "
    `);
  });

  it('should correctly add the imported symbol to the Component', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    const pathToFile = `my.component.ts`;
    const originalContents = `import { Component } from '@angular/core';
    
    @Component({})
    export class MyComponent {}
    `;

    tree.write(pathToFile, originalContents);

    const symbolToAdd = `CommonModule`;

    const sourceText = tree.read(pathToFile, 'utf-8');
    const tsSourceFile = createSourceFile(
      pathToFile,
      sourceText,
      ScriptTarget.Latest,
      true
    );

    // ACT
    addImportToComponent(tree, tsSourceFile, pathToFile, symbolToAdd);

    // ASSERT
    expect(tree.read(pathToFile, 'utf-8')).toMatchInlineSnapshot(`
      "import { Component } from '@angular/core';
          
          @Component({  imports: [CommonModule]
      })
          export class MyComponent {}
          "
    `);
  });

  it('should correctly add the imported symbol to the Directive', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    const pathToFile = `my.directive.ts`;
    const originalContents = `import { Directive } from '@angular/core';
    
    @Directive({})
    export class MyDirective {}
    `;

    tree.write(pathToFile, originalContents);

    const symbolToAdd = `CommonModule`;

    const sourceText = tree.read(pathToFile, 'utf-8');
    const tsSourceFile = createSourceFile(
      pathToFile,
      sourceText,
      ScriptTarget.Latest,
      true
    );

    // ACT
    addImportToDirective(tree, tsSourceFile, pathToFile, symbolToAdd);

    // ASSERT
    expect(tree.read(pathToFile, 'utf-8')).toMatchInlineSnapshot(`
      "import { Directive } from '@angular/core';
          
          @Directive({  imports: [CommonModule]
      })
          export class MyDirective {}
          "
    `);
  });

  it('should correctly add the imported symbol to the Pipe', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    const pathToFile = `my.pipe.ts`;
    const originalContents = `import { Pipe } from '@angular/core';
    
    @Pipe({})
    export class MyPipe {}
    `;

    tree.write(pathToFile, originalContents);

    const symbolToAdd = `CommonModule`;

    const sourceText = tree.read(pathToFile, 'utf-8');
    const tsSourceFile = createSourceFile(
      pathToFile,
      sourceText,
      ScriptTarget.Latest,
      true
    );

    // ACT
    addImportToPipe(tree, tsSourceFile, pathToFile, symbolToAdd);

    // ASSERT
    expect(tree.read(pathToFile, 'utf-8')).toMatchInlineSnapshot(`
      "import { Pipe } from '@angular/core';
          
          @Pipe({  imports: [CommonModule]
      })
          export class MyPipe {}
          "
    `);
  });

  it('should allow checking if a component is standalone and return true if so', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    const pathToFile = `my.component.ts`;
    const originalContents = `import { Component } from '@angular/core';
    
    @Component({
      standalone: true
    })
    export class MyComponent {}
    `;

    tree.write(pathToFile, originalContents);

    const sourceText = tree.read(pathToFile, 'utf-8');
    const tsSourceFile = createSourceFile(
      pathToFile,
      sourceText,
      ScriptTarget.Latest,
      true
    );

    // ACT
    // ASSERT
    expect(isStandalone(tsSourceFile, 'Component')).toBeTruthy();
  });

  it('should allow checking if a component is standalone and return false if not', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    const pathToFile = `my.component.ts`;
    const originalContents = `import { Component } from '@angular/core';
    
    @Component({
      standalone: false
    })
    export class MyComponent {}
    `;

    tree.write(pathToFile, originalContents);

    const sourceText = tree.read(pathToFile, 'utf-8');
    const tsSourceFile = createSourceFile(
      pathToFile,
      sourceText,
      ScriptTarget.Latest,
      true
    );

    // ACT
    // ASSERT
    expect(isStandalone(tsSourceFile, 'Component')).not.toBeTruthy();
  });

  it('should allow checking if a directive is standalone and return true if so', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    const pathToFile = `my.directive.ts`;
    const originalContents = `import { Directive } from '@angular/core';
    
    @Directive({
      standalone: true
    })
    export class MyDirective {}
    `;

    tree.write(pathToFile, originalContents);

    const sourceText = tree.read(pathToFile, 'utf-8');
    const tsSourceFile = createSourceFile(
      pathToFile,
      sourceText,
      ScriptTarget.Latest,
      true
    );

    // ACT
    // ASSERT
    expect(isStandalone(tsSourceFile, 'Directive')).toBeTruthy();
  });

  it('should allow checking if a pipe is standalone and return true if so', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    const pathToFile = `my.pipe.ts`;
    const originalContents = `import { Pipe } from '@angular/core';
    
    @Pipe({
      standalone: true
    })
    export class MyPipe {}
    `;

    tree.write(pathToFile, originalContents);

    const sourceText = tree.read(pathToFile, 'utf-8');
    const tsSourceFile = createSourceFile(
      pathToFile,
      sourceText,
      ScriptTarget.Latest,
      true
    );

    // ACT
    // ASSERT
    expect(isStandalone(tsSourceFile, 'Pipe')).toBeTruthy();
  });

  it('should add a provider to the bootstrapApplication call', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write(
      'main.ts',
      `import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation()),
  ],
}).catch((err) => console.error(err));`
    );

    // ACT
    addProviderToBootstrapApplication(tree, 'main.ts', 'provideStore()');

    // ASSERT
    expect(tree.read('main.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { bootstrapApplication } from '@angular/platform-browser';
      import {
        provideRouter,
        withEnabledBlockingInitialNavigation,
      } from '@angular/router';
      import { AppComponent } from './app/app.component';
      import { appRoutes } from './app/app.routes';

      bootstrapApplication(AppComponent, {
        providers: [provideStore(),
          provideRouter(appRoutes, withEnabledBlockingInitialNavigation()),
        ],
      }).catch((err) => console.error(err));"
    `);
  });

  it('should add a provider to the appConfig', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write(
      'app.config.ts',
      `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes) ]
};`
    );

    // ACT
    addProviderToAppConfig(tree, 'app.config.ts', 'provideStore()');

    // ASSERT
    expect(tree.read('app.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { ApplicationConfig } from '@angular/core';
      import { provideRouter } from '@angular/router';

      import { routes } from './app.routes';

      export const appConfig: ApplicationConfig = {
        providers: [provideStore(),provideRouter(routes) ]
      };"
    `);
  });
});
