import type { Tree } from '@nrwl/devkit';
import { insertImport } from '@nrwl/js';
import { ensureTypescript } from '@nrwl/js/src/utils/typescript/ensure-typescript';
import { addImportToModule } from '../../../../utils/nx-devkit/ast-utils';
import type { NormalizedSchema } from './normalized-schema';

let tsModule: typeof import('typescript');

export function addRouterRootConfiguration(
  host: Tree,
  options: NormalizedSchema
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const modulePath = `${options.appProjectRoot}/src/app/app.module.ts`;
  const moduleSource = host.read(modulePath, 'utf-8');

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
