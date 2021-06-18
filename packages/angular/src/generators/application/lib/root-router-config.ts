import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import * as ts from 'typescript';
import { addImportToModule } from '../../../utils/nx-devkit/ast-utils';

export function addRouterRootConfiguration(
  host: Tree,
  options: NormalizedSchema
) {
  const modulePath = `${options.appProjectRoot}/src/app/app.module.ts`;
  const moduleSource = host.read(modulePath, 'utf-8');

  let sourceFile = ts.createSourceFile(
    modulePath,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );

  sourceFile = insertImport(
    host,
    sourceFile,
    modulePath,
    'RouterModule',
    '@angular/router'
  );
  sourceFile = addImportToModule(
    host,
    sourceFile,
    modulePath,
    `RouterModule.forRoot([], {initialNavigation: 'enabledBlocking'})`
  );
}
