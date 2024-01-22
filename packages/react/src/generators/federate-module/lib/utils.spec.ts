import * as ts from 'typescript';
import { updateExposesProperty, createObjectEntry, findExposes } from './utils';
import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';

describe('federate-module Utils', () => {
  let tree: Tree = null;

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
  });
  describe('findExposes', () => {
    it('should find the exposes object', () => {
      const fileContent = `
      module.exports = {
        name: 'myremote',
        exposes: {
            './Module': './src/remote-entry.ts',
        }
    };
    `;
      const sourceFile = ts.createSourceFile(
        'module-federation.config.js',
        fileContent,
        ts.ScriptTarget.ES2015,
        true
      );
      const exposesObject = findExposes(sourceFile);
      expect(exposesObject).toBeDefined();
      expect(exposesObject?.properties.length).toEqual(1);
    });
  });

  describe('createObjectEntry', () => {
    it('should update the exposes object with a new entry', () => {
      const newEntry = createObjectEntry(
        'NewModule',
        './src/new-remote-entry.ts'
      );
      expect(newEntry).toBeDefined();

      // Creating a printer to convert AST nodes to string, for safer assertions.
      const printer = ts.createPrinter();
      const newEntryText = printer.printNode(
        ts.EmitHint.Unspecified,
        newEntry,
        ts.createSourceFile('', '', ts.ScriptTarget.ES2015)
      );

      expect(newEntryText).toEqual(
        `'./NewModule': './src/new-remote-entry.ts'`
      );
    });
  });

  describe('updateExposesProperty', () => {
    it('should update the exposes object with a new entry', () => {
      const moduleName = 'NewModule';
      const modulePath = './src/new-remote-entry.ts';
      const fileName = 'module-federation.config.js';

      const fileContent = `
      module.exports = {
        name: 'myremote',
        exposes: {
            './Module': './src/remote-entry.ts',
        }
    };
    `;

      tree.write(fileName, fileContent);

      updateExposesProperty(tree, fileName, moduleName, modulePath);
      const printer = ts.createPrinter();

      const updatedSource = ts.createSourceFile(
        fileName,
        tree.read(fileName).toString(),
        ts.ScriptTarget.ES2015,
        true
      );

      const updatedContent = printer.printFile(updatedSource);

      expect(updatedContent).toContain(moduleName);
      expect(updatedContent).toContain(modulePath);
    });
  });
});
