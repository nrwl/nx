import type { Tree } from '@nrwl/devkit';
import {
  addGlobal,
  removeChange,
} from '@nrwl/workspace/src/utilities/ast-utils';
import type { NormalizedOptions } from '../schema';

let tsModule: typeof import('typescript');

export function addExportsToBarrelFile(
  tree: Tree,
  options: NormalizedOptions
): void {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  const indexPath = `${options.projectRoot}/src/index.ts`;
  const indexContent = tree.read(indexPath, 'utf-8');
  let sourceFile = tsModule.createSourceFile(
    indexPath,
    indexContent,
    tsModule.ScriptTarget.Latest,
    true
  );

  sourceFile = removeChange(
    tree,
    sourceFile,
    indexPath,
    0,
    `export * from './lib/${options.fileName}';`
  );
  sourceFile = addGlobal(
    tree,
    sourceFile,
    indexPath,
    `export * from './lib/${options.fileName}.module';`
  );

  if (options.service) {
    sourceFile = addGlobal(
      tree,
      sourceFile,
      indexPath,
      `export * from './lib/${options.fileName}.service';`
    );
  }
  if (options.controller) {
    sourceFile = addGlobal(
      tree,
      sourceFile,
      indexPath,
      `export * from './lib/${options.fileName}.controller';`
    );
  }
}
