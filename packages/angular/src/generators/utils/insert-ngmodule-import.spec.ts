import { Tree } from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';
import { insertNgModuleImport } from './insert-ngmodule-import';

describe('insertNgModuleImport', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should add imports to an ng module with no options', () => {
    tree.write(
      'app.module.ts',
      `import { NgModule } from '@angular/core'; @NgModule() class MyModule {}`
    );

    insertNgModuleImport(tree, 'app.module.ts', 'HttpClientModule');

    expect(tree.read('app.module.ts').toString()).toMatchInlineSnapshot(
      `"import { NgModule } from '@angular/core'; @NgModule({ imports: [HttpClientModule]}) class MyModule {}"`
    );
  });

  it('should add imports to an ng module with options without imports', () => {
    tree.write(
      'app.module.ts',
      `import { NgModule } from '@angular/core'; @NgModule({ declarations: [MyComponent] }) class MyModule {}`
    );

    insertNgModuleImport(tree, 'app.module.ts', 'HttpClientModule');

    expect(tree.read('app.module.ts').toString()).toMatchInlineSnapshot(
      `"import { NgModule } from '@angular/core'; @NgModule({ declarations: [MyComponent] , imports: [HttpClientModule]}) class MyModule {}"`
    );
  });

  it('should add imports to an ng module with options with existing imports', () => {
    tree.write(
      'app.module.ts',
      `import { NgModule } from '@angular/core'; @NgModule({ declarations: [MyComponent], imports: [CommonModule] }) class MyModule {}`
    );

    insertNgModuleImport(tree, 'app.module.ts', 'HttpClientModule');

    expect(tree.read('app.module.ts').toString()).toMatchInlineSnapshot(
      `"import { NgModule } from '@angular/core'; @NgModule({ declarations: [MyComponent], imports: [CommonModule, HttpClientModule] }) class MyModule {}"`
    );
  });

  it('should add imports to an ng module with options with existing imports with a trailing comma', () => {
    tree.write(
      'app.module.ts',
      `import { NgModule } from '@angular/core'; @NgModule({ declarations: [MyComponent], imports: [CommonModule,] }) class MyModule {}`
    );

    insertNgModuleImport(tree, 'app.module.ts', 'HttpClientModule');

    expect(tree.read('app.module.ts').toString()).toMatchInlineSnapshot(
      `"import { NgModule } from '@angular/core'; @NgModule({ declarations: [MyComponent], imports: [CommonModule,HttpClientModule,] }) class MyModule {}"`
    );
  });
});
