import { findNodes } from '@nx/js';
import type * as ts from 'typescript';
import { ensureTypescript, type TypescriptAst } from '@nx/devkit/internal';
import { ChangeType, StringChange } from '@nx/devkit';

let tsModule: TypescriptAst;

export function addImport(
  source: ts.SourceFile,
  statement: string
): StringChange[] {
  tsModule ??= ensureTypescript();
  const allImports = findNodes(source, tsModule.SyntaxKind.ImportDeclaration);
  if (allImports.length > 0) {
    const lastImport = allImports[allImports.length - 1];
    return [
      {
        type: ChangeType.Insert,
        index: lastImport.end + 1,
        text: `\n${statement}\n`,
      },
    ];
  } else {
    return [
      {
        type: ChangeType.Insert,
        index: 0,
        text: `\n${statement}\n`,
      },
    ];
  }
}
