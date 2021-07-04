import type { Tree } from '@nrwl/devkit';
import { names } from '@nrwl/devkit';
import {
  insertImport,
  addGlobal,
} from '@nrwl/workspace/src/utilities/ast-utils';
import * as ts from 'typescript';
import { addImportToModule } from '../../../utils/nx-devkit/ast-utils';
import { NormalizedSchema } from './normalized-schema';

export function addRouterConfiguration(host: Tree, options: NormalizedSchema) {
  const constName = `${names(options.fileName).propertyName}Routes`;
  const moduleSource = host.read(options.modulePath)!.toString('utf-8');
  let moduleSourceFile = ts.createSourceFile(
    options.modulePath,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );

  moduleSourceFile = addImportToModule(
    host,
    moduleSourceFile,
    options.modulePath,
    `RouterModule`
  );
  moduleSourceFile = insertImport(
    host,
    moduleSourceFile,
    options.modulePath,
    'RouterModule, Route',
    '@angular/router'
  );
  moduleSourceFile = addGlobal(
    host,
    moduleSourceFile,
    options.modulePath,
    `export const ${constName}: Route[] = [];`
  );
}
