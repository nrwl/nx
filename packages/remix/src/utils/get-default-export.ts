import { Tree } from '@nx/devkit';
import {
  createSourceFile,
  isFunctionDeclaration,
  ScriptTarget,
  SyntaxKind,
} from 'typescript';

export function getDefaultExport(tree: Tree, path: string) {
  const contents = tree.read(path, 'utf-8');

  const sourceFile = createSourceFile(path, contents, ScriptTarget.ESNext);

  const functionDeclarations = sourceFile.statements.filter(
    isFunctionDeclaration
  );

  return functionDeclarations.find((functionDeclaration) => {
    const isDefault = functionDeclaration.modifiers.find(
      (mod) => mod.kind === SyntaxKind.DefaultKeyword
    );

    const isExport = functionDeclaration.modifiers.find(
      (mod) => mod.kind === SyntaxKind.ExportKeyword
    );

    return isDefault && isExport;
  });
}
