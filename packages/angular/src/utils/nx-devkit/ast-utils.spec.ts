import {
  addImportToComponent,
  addImportToDirective,
  addImportToModule,
  addImportToPipe,
} from './ast-utils';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { createSourceFile, ScriptTarget } from 'typescript';

describe('Angular AST Utils', () => {
  it('should correctly add the imported symbol to the NgModule', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
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
    const tree = createTreeWithEmptyWorkspace();
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
    const tree = createTreeWithEmptyWorkspace();
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
    const tree = createTreeWithEmptyWorkspace();
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
});
