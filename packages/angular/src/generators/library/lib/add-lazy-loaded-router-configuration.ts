import { Tree } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import * as ts from 'typescript';
import { addImportToModule } from '../../../utils/nx-devkit/ast-utils';
import { NormalizedSchema } from './normalized-schema';

export function addLazyLoadedRouterConfiguration(
  host: Tree,
  options: NormalizedSchema
) {
  const moduleSource = host.read(options.modulePath)!.toString('utf-8');
  const sourceFile = ts.createSourceFile(
    options.modulePath,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );
  addImportToModule(
    host,
    sourceFile,
    options.modulePath,
    `
    RouterModule.forChild([
      /* {path: '', pathMatch: 'full', component: InsertYourComponentHere} */
    ]) `
  );
  insertImport(
    host,
    sourceFile,
    options.modulePath,
    'RouterModule',
    '@angular/router'
  );
}
