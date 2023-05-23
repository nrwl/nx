import {
  addDependenciesToPackageJson,
  applyChangesToString,
  joinPathFragments,
  names,
  Tree,
} from '@nx/devkit';
import type * as ts from 'typescript';

import { NormalizedSchema } from '../schema';
import {
  addBrowserRouter,
  addRoute,
  findComponentImportPath,
} from '../../../utils/ast-utils';
import { addInitialRoutes } from '../../../utils/ast-utils';
import { maybeJs } from './maybe-js';
import { reactRouterDomVersion } from '../../../utils/versions';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { getImportPath } from '@nx/js/src/utils/get-import-path';

let tsModule: typeof import('typescript');

export function updateAppRoutes(host: Tree, options: NormalizedSchema) {
  if (!options.appMain || !options.appSourceRoot) {
    return () => {};
  }

  const { content, source } = readComponent(host, options.appMain);

  const componentImportPath = findComponentImportPath('App', source);

  if (!componentImportPath) {
    throw new Error(
      `Could not find App component in ${options.appMain} (Hint: you can omit --appProject, or make sure App exists)`
    );
  }

  const appComponentPath = joinPathFragments(
    options.appSourceRoot,
    maybeJs(options, `${componentImportPath}.tsx`)
  );

  const routerTask = addDependenciesToPackageJson(
    host,
    {
      'react-router-dom': reactRouterDomVersion,
    },
    {}
  );

  // addBrowserRouterToMain
  const isRouterPresent = content.match(/react-router-dom/);
  if (!isRouterPresent) {
    const changes = applyChangesToString(
      content,
      addBrowserRouter(options.appMain, source)
    );
    host.write(options.appMain, changes);
  }

  // addInitialAppRoutes
  {
    const { content: componentContent, source: componentSource } =
      readComponent(host, appComponentPath);
    const isComponentRouterPresent = componentContent.match(/react-router-dom/);
    if (!isComponentRouterPresent) {
      const changes = applyChangesToString(
        componentContent,
        addInitialRoutes(appComponentPath, componentSource)
      );
      host.write(appComponentPath, changes);
    }
  }

  // addNewAppRoute
  {
    const { content: componentContent, source: componentSource } =
      readComponent(host, appComponentPath);
    const changes = applyChangesToString(
      componentContent,
      addRoute(appComponentPath, componentSource, {
        routePath: options.routePath,
        componentName: names(options.name).className,
        moduleName: getImportPath(host, options.projectDirectory),
      })
    );
    host.write(appComponentPath, changes);
  }

  return routerTask;
}

function readComponent(
  host: Tree,
  path: string
): { content: string; source: ts.SourceFile } {
  if (!host.exists(path)) {
    throw new Error(`Cannot find ${path}`);
  }
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const content = host.read(path, 'utf-8');

  const source = tsModule.createSourceFile(
    path,
    content,
    tsModule.ScriptTarget.Latest,
    true
  );

  return { content, source };
}
