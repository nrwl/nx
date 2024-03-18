import { applyChangesToString, ChangeType, Tree } from '@nx/devkit';
import {
  createSourceFile,
  isImportDeclaration,
  isNamedImports,
  isStringLiteral,
  NamedImports,
  ScriptTarget,
} from 'typescript';
import { insertStatementAfterImports } from './insert-statement-after-imports';

export function insertImport(
  tree: Tree,
  path: string,
  name: string,
  modulePath: string,
  options: { typeOnly: boolean } = { typeOnly: false }
) {
  if (!tree.exists(path))
    throw Error(
      `Could not insert import ${name} from ${modulePath} in ${path}: path not found`
    );

  const contents = tree.read(path, 'utf-8');

  const sourceFile = createSourceFile(path, contents, ScriptTarget.ESNext);

  let importStatements = sourceFile.statements.filter(isImportDeclaration);

  if (options.typeOnly) {
    importStatements = importStatements.filter(
      (node) => node.importClause.isTypeOnly
    );
  } else {
    importStatements = importStatements.filter(
      (node) => !node.importClause.isTypeOnly
    );
  }

  const existingImport = importStatements.find(
    (statement) =>
      isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier
        .getText(sourceFile)
        .replace(/['"`]/g, '')
        .trim() === modulePath &&
      statement.importClause.namedBindings &&
      isNamedImports(statement.importClause.namedBindings)
  );

  if (!existingImport) {
    insertStatementAfterImports(
      tree,
      path,
      options.typeOnly
        ? `import type { ${name} } from '${modulePath}';`
        : `import { ${name} } from '${modulePath}';`
    );
    return;
  }

  const namedImports = existingImport.importClause
    .namedBindings as NamedImports;

  const alreadyImported =
    namedImports.elements.find(
      (element) => element.name.escapedText === name
    ) !== undefined;

  if (!alreadyImported) {
    const index = namedImports.getEnd() - 1;

    let text: string;
    if (namedImports.elements.hasTrailingComma) {
      text = `${name},`;
    } else {
      text = `,${name}`;
    }

    const newContents = applyChangesToString(contents, [
      {
        type: ChangeType.Insert,
        index,
        text,
      },
    ]);

    tree.write(path, newContents);
  }
}
