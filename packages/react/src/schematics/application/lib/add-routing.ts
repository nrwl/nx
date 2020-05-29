import * as ts from 'typescript';
import {
  chain,
  noop,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { join } from '@angular-devkit/core';
import { addDepsToPackageJson, insert } from '@nrwl/workspace';
import { addInitialRoutes } from '../../../utils/ast-utils';
import { NormalizedSchema } from '../schema';
import {
  reactRouterDomVersion,
  typesReactRouterDomVersion,
} from '@nrwl/react/src/utils/versions';

export function addRouting(
  options: NormalizedSchema,
  context: SchematicContext
): Rule {
  return options.routing
    ? chain([
        function addRouterToComponent(host: Tree) {
          const appPath = join(
            options.appProjectRoot,
            maybeJs(options, `src/app/${options.fileName}.tsx`)
          );
          const appFileContent = host.read(appPath).toString('utf-8');
          const appSource = ts.createSourceFile(
            appPath,
            appFileContent,
            ts.ScriptTarget.Latest,
            true
          );

          insert(host, appPath, addInitialRoutes(appPath, appSource, context));
        },
        addDepsToPackageJson(
          { 'react-router-dom': reactRouterDomVersion },
          { '@types/react-router-dom': typesReactRouterDomVersion }
        ),
      ])
    : noop();
}

function maybeJs(options: NormalizedSchema, path: string): string {
  return options.js && (path.endsWith('.ts') || path.endsWith('.tsx'))
    ? path.replace(/\.tsx?$/, '.js')
    : path;
}
