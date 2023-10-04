import type { Tree } from '@nx/devkit';
import { addGlobal, removeChange } from '@nx/js';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import type { NormalizedOptions } from '../schema';

let tsModule: typeof import('typescript');

export function addExportsToBarrelFile(
  tree: Tree,
  options: NormalizedOptions
): void {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const indexPath = `${options.projectRoot}/src/index.ts`;
  const indexContent = tree.read(indexPath, 'utf-8');
  let sourceFile = tsModule.createSourceFile(
    indexPath,
    indexContent,
    tsModule.ScriptTarget.Latest,
    true
  );

  // find the export in the source file
  const exportStatement = sourceFile.statements.find((statement) =>
    tsModule.isExportDeclaration(statement)
  );

  sourceFile = removeChange(
    tree,
    sourceFile,
    indexPath,
    0,
    exportStatement.getFullText()
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
