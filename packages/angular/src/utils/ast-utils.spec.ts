import { InsertChange } from '@nrwl/workspace/src/utils/ast-utils';
import { createSourceFile, ScriptTarget } from 'typescript';
import { addProviderToModule } from './ast-utils';

describe('ast-utils', () => {
  describe('_addSymbolToNgModuleMetadata', () => {
    const moduleImport = `import { NgModule } from '@angular/core';`;
    const fileName = 'app.module.ts';
    const createTemplate = (content: string, close: string) => ({
      start: content.length,
      text: content + close,
    });
    const createStockModule = (content: string) =>
      createSourceFile(fileName, content, ScriptTarget.Latest, true);

    it('should add provider to module without existing providers', () => {
      const toAdd = 'MyProvider';

      const { start, text } = createTemplate(
        moduleImport + '@NgModule({',
        '})'
      );
      const source = createStockModule(text);
      const change = addProviderToModule(source, fileName, toAdd);
      const expectedChange = [
        new InsertChange(fileName, start, `  providers: [${toAdd}]\n`),
      ];

      expect(change).toEqual(expectedChange);
    });

    it('should add provider to module with existing empty providers', () => {
      const toAdd = 'MyProvider';

      const { start, text } = createTemplate(
        moduleImport + '@NgModule({providers:[',
        ']})'
      );
      const source = createStockModule(text);
      const change = addProviderToModule(source, fileName, toAdd);
      const expectedChange = [new InsertChange(fileName, start, toAdd)];

      expect(change).toEqual(expectedChange);
    });

    it('should add provider to module with existing providers', () => {
      const toAdd = 'MyProvider';

      let template = createTemplate(
        moduleImport + '@NgModule({providers:[ProviderOne,ProviderTwo',
        ']})'
      );
      let source = createStockModule(template.text);
      let change = addProviderToModule(source, fileName, toAdd);
      let expectedChange = [
        new InsertChange(fileName, template.start, `, ${toAdd}`),
      ];

      expect(change).toEqual(expectedChange);

      template = createTemplate(
        moduleImport +
          '@NgModule({providers:[{provide:MyClass,useExisting:MyExistingClass}',
        ']})'
      );
      source = createStockModule(template.text);
      change = addProviderToModule(source, fileName, toAdd);
      expectedChange = [
        new InsertChange(fileName, template.start, `, ${toAdd}`),
      ];

      expect(change).toEqual(expectedChange);

      template = createTemplate(
        moduleImport + '@NgModule({providers:[someCondition ? MyProvider : []',
        ']})'
      );
      source = createStockModule(template.text);
      change = addProviderToModule(source, fileName, toAdd);
      expectedChange = [
        new InsertChange(fileName, template.start, `, ${toAdd}`),
      ];

      expect(change).toEqual(expectedChange);

      template = createTemplate(
        moduleImport +
          '@NgModule({providers:[[NestedProvider1, NestedProvider2]',
        ']})'
      );
      source = createStockModule(template.text);
      change = addProviderToModule(source, fileName, toAdd);
      expectedChange = [
        new InsertChange(fileName, template.start, `, ${toAdd}`),
      ];

      expect(change).toEqual(expectedChange);

      template = createTemplate(
        moduleImport + '@NgModule({providers:[...ExistingProviders',
        ']})'
      );
      source = createStockModule(template.text);
      change = addProviderToModule(source, fileName, toAdd);
      expectedChange = [
        new InsertChange(fileName, template.start, `, ${toAdd}`),
      ];

      expect(change).toEqual(expectedChange);
    });
  });
});
