import { findNodes } from '@nrwl/workspace/src/utilities/typescript';
import * as ts from 'typescript';
import { ChangeType, StringChange } from '@nrwl/devkit';

export function addImport(
  source: ts.SourceFile,
  statement: string
): StringChange[] {
  const allImports = findNodes(source, ts.SyntaxKind.ImportDeclaration);
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
