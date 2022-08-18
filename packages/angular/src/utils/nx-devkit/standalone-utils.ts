import { Tree } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';

export function addStandaloneRoute(
  tree: Tree,
  parentPath: string,
  route: string,
  lazy: boolean = true,
  routesConst?: string,
  importPath?: string
) {
  if (!tree.exists(parentPath)) {
    throw new Error(
      `Path to parent routing declaration (${parentPath}) does not exist. Please ensure path is correct.`
    );
  }

  let parentContents = tree.read(parentPath, 'utf-8');

  if (!lazy) {
    let parentSourceFile = ts.createSourceFile(
      parentPath,
      parentContents,
      ts.ScriptTarget.Latest,
      true
    );

    parentSourceFile = insertImport(
      tree,
      parentSourceFile,
      parentPath,
      routesConst,
      importPath
    );

    parentContents = tree.read(parentPath, 'utf-8');
  }

  const ast = tsquery.ast(parentContents);

  const IMPORT_PROVIDERS_FROM_ROUTER_MODULE_SELECTOR =
    'CallExpression:has(Identifier[name=importProvidersFrom]) CallExpression:has(PropertyAccessExpression:has(Identifier[name=RouterModule])) > ArrayLiteralExpression';

  const ROUTES_ARRAY_SELECTOR =
    'VariableDeclaration:has(ArrayType > TypeReference > Identifier[name=Route]) > ArrayLiteralExpression';

  const routerModuleNodes = tsquery(
    ast,
    IMPORT_PROVIDERS_FROM_ROUTER_MODULE_SELECTOR,
    { visitAllChildren: true }
  );
  const isImportProvidersFromRouterSetup = routerModuleNodes.length > 0;

  const routesArrayNodes = tsquery(ast, ROUTES_ARRAY_SELECTOR, {
    visitAllChildren: true,
  });
  const isRoutesArray = routesArrayNodes.length > 0;

  if (!isImportProvidersFromRouterSetup && !isRoutesArray) {
    throw new Error(
      'Parent routing declaration does not contain a routing configuration. Please ensure the parent contains a routing configuration.'
    );
  }

  const nodes = isImportProvidersFromRouterSetup
    ? routerModuleNodes
    : routesArrayNodes;

  const newParentContents = `${parentContents.slice(0, nodes[0].getStart() + 1)}
    ${route},${parentContents.slice(nodes[0].getStart() + 1, -1)}`;

  tree.write(parentPath, newParentContents);
}
