import { Tree } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import { addRouteToNgModule } from './ast-utils';

export function addRoute(
  tree: Tree,
  routesFile: string,
  route: string,
  lazy: boolean = true,
  routesConst?: string,
  importPath?: string
) {
  if (!tree.exists(routesFile)) {
    throw new Error(
      `Path to parent routing declaration (${routesFile}) does not exist. Please ensure path is correct.`
    );
  }

  let routesFileContents = tree.read(routesFile, 'utf-8');

  if (!lazy) {
    let parentSourceFile = ts.createSourceFile(
      routesFile,
      routesFileContents,
      ts.ScriptTarget.Latest,
      true
    );

    parentSourceFile = insertImport(
      tree,
      parentSourceFile,
      routesFile,
      routesConst,
      importPath
    );

    routesFileContents = tree.read(routesFile, 'utf-8');
  }

  const ast = tsquery.ast(routesFileContents);

  const ROUTES_ARRAY_SELECTOR =
    'VariableDeclaration:has(ArrayType > TypeReference > Identifier[name=Route], Identifier[name=Routes]) > ArrayLiteralExpression';

  const routesArrayNodes = tsquery(ast, ROUTES_ARRAY_SELECTOR, {
    visitAllChildren: true,
  });
  const isRoutesArray = routesArrayNodes.length > 0;

  if (!isRoutesArray) {
    if (routesFileContents.includes('@NgModule')) {
      const sourceFile = ts.createSourceFile(
        routesFile,
        routesFileContents,
        ts.ScriptTarget.Latest,
        true
      );

      addRouteToNgModule(tree, routesFile, sourceFile, route);
      return;
    } else {
      throw new Error(
        `Routing file (${routesFile}) does not a routing configuration. Please ensure the parent contains a routing configuration.`
      );
    }
  }

  const newRoutesFileContents = `${routesFileContents.slice(
    0,
    routesArrayNodes[0].getStart() + 1
  )}
    ${route},${routesFileContents.slice(
    routesArrayNodes[0].getStart() + 1,
    -1
  )}`;

  tree.write(routesFile, newRoutesFileContents);
}
