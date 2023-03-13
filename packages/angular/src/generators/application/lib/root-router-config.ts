import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { insertImport } from '@nrwl/js';
import { addImportToModule } from '../../../utils/nx-devkit/ast-utils';
import { ensureTypescript } from '@nrwl/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

export function addRouterRootConfiguration(
  host: Tree,
  options: NormalizedSchema
) {
  const modulePath = `${options.appProjectRoot}/src/app/app.module.ts`;
  const moduleSource = host.read(modulePath, 'utf-8');

  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  let sourceFile = tsModule.createSourceFile(
    modulePath,
    moduleSource,
    tsModule.ScriptTarget.Latest,
    true
  );

  sourceFile = insertImport(
    host,
    sourceFile,
    modulePath,
    'RouterModule',
    '@angular/router'
  );
  sourceFile = insertImport(
    host,
    sourceFile,
    modulePath,
    'appRoutes',
    './app.routes'
  );
  sourceFile = addImportToModule(
    host,
    sourceFile,
    modulePath,
    `RouterModule.forRoot(appRoutes, {initialNavigation: 'enabledBlocking'})`
  );
}
