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
  const moduleSource = host.read(options.modulePath)!.toString('utf-8');
  const moduleSourceFile = ts.createSourceFile(
    options.modulePath,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );
  const constName = `${names(options.fileName).propertyName}Routes`;

  addImportToModule(host, moduleSourceFile, options.modulePath, `RouterModule`);
  insertImport(
    host,
    moduleSourceFile,
    options.modulePath,
    'RouterModule, Route',
    '@angular/router'
  );
  addGlobal(
    host,
    moduleSourceFile,
    options.modulePath,
    `export const ${constName}: Route[] = [];`
  );
}
