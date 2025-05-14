import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createSourceFile, ScriptTarget } from 'typescript';
import {
  addImportToComponent,
  addImportToDirective,
  addImportToModule,
  addImportToPipe,
  addProviderToAppConfig,
  addProviderToBootstrapApplication,
  addViewProviderToComponent,
  isStandalone,
} from './ast-utils';

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

  describe('isStandalone', () => {
    it('should return true for a component when "standalone: true" is set', () => {
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
      expect(isStandalone(tree, tsSourceFile, 'Component')).toBeTruthy();
    });

    it('should return true for a component when the "standalone" prop is not set and the angular version is 19 or above', () => {
      const tree = createTreeWithEmptyWorkspace({});
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '^19.0.0';
        return json;
      });
      const componentSourceText = `import { Component } from '@angular/core';
      
      @Component({})
      export class MyComponent {}
      `;
      const tsSourceFile = createSourceFile(
        'my.component.ts',
        componentSourceText,
        ScriptTarget.Latest,
        true
      );

      expect(isStandalone(tree, tsSourceFile, 'Component')).toBe(true);
    });

    it('should return false for a component when "standalone: false" is set', () => {
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
      expect(isStandalone(tree, tsSourceFile, 'Component')).not.toBeTruthy();
    });

    it('should return false for a component when the "standalone" prop is not set and the angular version is 18 or below', () => {
      const tree = createTreeWithEmptyWorkspace({});
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '^18.0.0';
        return json;
      });
      const componentSourceText = `import { Component } from '@angular/core';
      
      @Component({})
      export class MyComponent {}
      `;
      const tsSourceFile = createSourceFile(
        'my.component.ts',
        componentSourceText,
        ScriptTarget.Latest,
        true
      );

      expect(isStandalone(tree, tsSourceFile, 'Component')).toBe(false);
    });

    it('should return true for a directive when "standalone: true" is set', () => {
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
      expect(isStandalone(tree, tsSourceFile, 'Directive')).toBeTruthy();
    });

    it('should return true for a directive when the "standalone" prop is not set and the angular version is 19 or above', () => {
      const tree = createTreeWithEmptyWorkspace({});
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '^19.0.0';
        return json;
      });
      const directiveSourceText = `import { Directive } from '@angular/core';
      
      @Directive({})
      export class MyDirective {}
      `;
      const tsSourceFile = createSourceFile(
        'my.directive.ts',
        directiveSourceText,
        ScriptTarget.Latest,
        true
      );

      expect(isStandalone(tree, tsSourceFile, 'Directive')).toBe(true);
    });

    it('should return false for a directive when "standalone: false" is set', () => {
      const tree = createTreeWithEmptyWorkspace({});
      const directiveSourceText = `import { Directive } from '@angular/core';
      
      @Directive({
        standalone: false
      })
      export class MyDirective {}
      `;
      const tsSourceFile = createSourceFile(
        'my.directive.ts',
        directiveSourceText,
        ScriptTarget.Latest,
        true
      );

      expect(isStandalone(tree, tsSourceFile, 'Directive')).toBe(false);
    });

    it('should return false for a directive when the "standalone" prop is not set and the angular version is 18 or below', () => {
      const tree = createTreeWithEmptyWorkspace({});
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '^18.0.0';
        return json;
      });
      const directiveSourceText = `import { Directive } from '@angular/core';
      
      @Directive({})
      export class MyDirective {}
      `;
      const tsSourceFile = createSourceFile(
        'my.component.ts',
        directiveSourceText,
        ScriptTarget.Latest,
        true
      );

      expect(isStandalone(tree, tsSourceFile, 'Directive')).toBe(false);
    });

    it('should return true for a pipe when "standalone: true" is set', () => {
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
      expect(isStandalone(tree, tsSourceFile, 'Pipe')).toBeTruthy();
    });

    it('should return true for a pipe when the "standalone" prop is not set and the angular version is 19 or above', () => {
      const tree = createTreeWithEmptyWorkspace({});
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '^19.0.0';
        return json;
      });
      const pipeSourceText = `import { Pipe } from '@angular/core';
      
      @Pipe({})
      export class MyPipe {}
      `;
      const tsSourceFile = createSourceFile(
        'my.pipe.ts',
        pipeSourceText,
        ScriptTarget.Latest,
        true
      );

      expect(isStandalone(tree, tsSourceFile, 'Pipe')).toBe(true);
    });

    it('should return false for a pipe when "standalone: false" is set', () => {
      const tree = createTreeWithEmptyWorkspace({});
      const pipeSourceText = `import { Pipe } from '@angular/core';
      
      @Pipe({
        standalone: false
      })
      export class MyPipe {}
      `;
      const tsSourceFile = createSourceFile(
        'my.pipe.ts',
        pipeSourceText,
        ScriptTarget.Latest,
        true
      );

      expect(isStandalone(tree, tsSourceFile, 'Pipe')).toBe(false);
    });

    it('should return false for a pipe when the "standalone" prop is not set and the angular version is 18 or below', () => {
      const tree = createTreeWithEmptyWorkspace({});
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '^18.0.0';
        return json;
      });
      const pipeSourceText = `import { Pipe } from '@angular/core';
      
      @Pipe({})
      export class MyPipe {}
      `;
      const tsSourceFile = createSourceFile(
        'my.pipe.ts',
        pipeSourceText,
        ScriptTarget.Latest,
        true
      );

      expect(isStandalone(tree, tsSourceFile, 'Pipe')).toBe(false);
    });
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

  it('should add view provider to a component', () => {
    // ARRANGE
    const pathToComponent = 'app.component.ts';
    const componentOriginal = `import { Component } from '@angular/core';

@Component({
  selector: 'app-app',
  template: ''
})
export class AppComponent {}
`;
    const providerName = 'MyViewProvider';

    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    tree.write(pathToComponent, componentOriginal);

    const tsSourceFile = createSourceFile(
      pathToComponent,
      componentOriginal,
      ScriptTarget.Latest,
      true
    );

    // ACT
    addViewProviderToComponent(
      tree,
      tsSourceFile,
      pathToComponent,
      providerName
    );

    // ASSERT
    expect(tree.read(pathToComponent, 'utf-8')).toMatchInlineSnapshot(`
      "import { Component } from '@angular/core';

      @Component({
        selector: 'app-app',
        template: '',
        viewProviders: [MyViewProvider]
      })
      export class AppComponent {}
      "
    `);
  });
});
