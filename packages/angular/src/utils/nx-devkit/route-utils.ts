import { Tree } from '@nx/devkit';
import { insertImport } from '@nx/js';
import { addRouteToNgModule } from './ast-utils';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

/**
 * Add a new route to a routes definition
 * @param tree Virtual Tree
 * @param routesFile File containing the routes definition
 * @param route Route to add
 * @param lazy If Route should be lazy-loaded
 * @param routesConst Used when eager-loading a route: Class name of the Component
 * @param importPath Used when eager-loading a route: The import path to the Component
 */
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const { tsquery } = require('@phenomnomnominal/tsquery');

  let routesFileContents = tree.read(routesFile, 'utf-8');

  if (!lazy) {
    let parentSourceFile = tsModule.createSourceFile(
      routesFile,
      routesFileContents,
      tsModule.ScriptTarget.Latest,
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
      const sourceFile = tsModule.createSourceFile(
        routesFile,
        routesFileContents,
        tsModule.ScriptTarget.Latest,
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
    ${route},${routesFileContents.slice(routesArrayNodes[0].getStart() + 1)}`;

  tree.write(routesFile, newRoutesFileContents);
}

/**
 * Add a provider to a standalone routes definition
 * @param tree Virtual Tree
 * @param routesFile The file containing the routes definition
 * @param routeToAddProviderTo The route to add the provider to
 * @param providerToAdd The provider to add to the route
 */
export function addProviderToRoute(
  tree: Tree,
  routesFile: string,
  routeToAddProviderTo: string,
  providerToAdd: string
) {
  if (!tree.exists(routesFile)) {
    throw new Error(
      `Path to parent routing declaration (${routesFile}) does not exist. Please ensure path is correct.`
    );
  }

  ensureTypescript();
  const { tsquery } = require('@phenomnomnominal/tsquery');
  let routesFileContents = tree.read(routesFile, 'utf-8');

  const ast = tsquery.ast(routesFileContents);

  const ROUTES_ARRAY_SELECTOR =
    'VariableDeclaration:has(ArrayType > TypeReference > Identifier[name=Route], Identifier[name=Routes]) > ArrayLiteralExpression';

  const routesArrayNodes = tsquery(ast, ROUTES_ARRAY_SELECTOR, {
    visitAllChildren: true,
  });
  const isRoutesArray = routesArrayNodes.length > 0;

  if (!isRoutesArray) {
    throw new Error(
      `Routing file (${routesFile}) does not a routing configuration. Please ensure the parent contains a routing configuration.`
    );
  }

  const ROUTE_SELECTOR = `ObjectLiteralExpression:has(PropertyAssignment:has(Identifier[name=path]) > StringLiteral[value=${routeToAddProviderTo}]):last-child`;
  const ROUTE_PATH_PROVIDERS_SELECTOR =
    'ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=providers])';

  const selectedRouteNodes = tsquery(routesArrayNodes[0], ROUTE_SELECTOR, {
    visitAllChildren: true,
  });
  if (selectedRouteNodes.length === 0) {
    throw new Error(
      `Could not find '${routeToAddProviderTo}' in routes definition.`
    );
  }

  for (const selectedRouteNode of selectedRouteNodes) {
    const routeProivdersNodes = tsquery(
      selectedRouteNode,
      ROUTE_PATH_PROVIDERS_SELECTOR,
      {
        visitAllChildren: true,
      }
    );

    if (routeProivdersNodes.length === 0) {
      const newFileContents = `${routesFileContents.slice(
        0,
        selectedRouteNode.getEnd() - 1
      )}${
        routesFileContents
          .slice(0, selectedRouteNode.getEnd() - 1)
          .trim()
          .endsWith(',')
          ? ''
          : ', '
      }providers: [${providerToAdd}]${routesFileContents.slice(
        selectedRouteNode.getEnd() - 1,
        routesFileContents.length
      )}`;

      tree.write(routesFile, newFileContents);
    } else {
      const newFileContents = `${routesFileContents.slice(
        0,
        routeProivdersNodes[0].getEnd() - 1
      )}, ${providerToAdd}${routesFileContents.slice(
        routeProivdersNodes[0].getEnd() - 1,
        routesFileContents.length
      )}`;

      tree.write(routesFile, newFileContents);
    }
  }
}
