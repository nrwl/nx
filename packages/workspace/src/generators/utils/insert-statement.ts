import { applyChangesToString, ChangeType, Tree } from '@nx/devkit';
import { ensureTypescript } from '../../utilities/typescript';

let tsModule: typeof import('typescript');

/**
 * Insert a statement after the last import statement in a file
 */
export function insertStatement(tree: Tree, path: string, statement: string) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const { createSourceFile, isImportDeclaration, ScriptTarget } = tsModule;

  const contents = tree.read(path, 'utf-8');

  const sourceFile = createSourceFile(path, contents, ScriptTarget.ESNext);

  const importStatements = sourceFile.statements.filter(isImportDeclaration);
  const index =
    importStatements.length > 0
      ? importStatements[importStatements.length - 1].getEnd()
      : 0;

  if (importStatements.length > 0) {
    statement = `\n${statement}`;
  }

  const newContents = applyChangesToString(contents, [
    {
      type: ChangeType.Insert,
      index,
      text: statement,
    },
  ]);

  tree.write(path, newContents);
}
