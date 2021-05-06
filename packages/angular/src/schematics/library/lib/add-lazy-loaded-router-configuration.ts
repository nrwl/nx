import { Rule, Tree } from '@angular-devkit/schematics';
import { insert } from '@nrwl/workspace';
import { insertImport } from '@nrwl/workspace/src/utils/ast-utils';
import * as ts from 'typescript';
import { addImportToModule } from '../../../utils/ast-utils';
import { NormalizedSchema } from './normalized-schema';

export function addLazyLoadedRouterConfiguration(
  options: NormalizedSchema
): Rule {
  return (host: Tree) => {
    const moduleSource = host.read(options.modulePath)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(
      options.modulePath,
      moduleSource,
      ts.ScriptTarget.Latest,
      true
    );
    insert(host, options.modulePath, [
      insertImport(
        sourceFile,
        options.modulePath,
        'RouterModule',
        '@angular/router'
      ),
      ...addImportToModule(
        sourceFile,
        options.modulePath,
        `
        RouterModule.forChild([
        /* {path: '', pathMatch: 'full', component: InsertYourComponentHere} */
       ]) `
      ),
    ]);
    return host;
  };
}
