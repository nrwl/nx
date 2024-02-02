import { stripIndents, type Tree } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { insertImport } from './insert-import';
import { insertStatementAfterImports } from './insert-statement-after-imports';

export function upsertLinksFunction(
  tree: Tree,
  filePath: string,
  importName: string,
  importPath: string,
  linkObject: string
) {
  insertImport(tree, filePath, 'LinksFunction', '@remix-run/node', {
    typeOnly: true,
  });
  insertStatementAfterImports(
    tree,
    filePath,
    stripIndents`import ${importName} from "${importPath}";`
  );

  const fileContents = tree.read(filePath, 'utf-8');
  const LINKS_FUNCTION_SELECTOR =
    'VariableDeclaration:has(TypeReference > Identifier[name=LinksFunction])';
  const ast = tsquery.ast(fileContents);

  const linksFunctionNodes = tsquery(ast, LINKS_FUNCTION_SELECTOR, {
    visitAllChildren: true,
  });
  if (linksFunctionNodes.length === 0) {
    insertStatementAfterImports(
      tree,
      filePath,
      stripIndents`export const links: LinksFunction = () => [
  ${linkObject},
];`
    );
  } else {
    const linksArrayNodes = tsquery(
      linksFunctionNodes[0],
      'ArrayLiteralExpression',
      { visitAllChildren: true }
    );
    const arrayNode = linksArrayNodes[0];
    const updatedFileContents = `${fileContents.slice(
      0,
      arrayNode.getStart() + 1
    )}\n${linkObject},${fileContents.slice(arrayNode.getStart() + 1)}`;
    tree.write(filePath, updatedFileContents);
  }
}
