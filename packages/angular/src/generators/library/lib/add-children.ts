import { Tree, names, getWorkspaceLayout } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import * as ts from 'typescript';
import {
  addImportToModule,
  addRoute,
} from '../../../utils/nx-devkit/ast-utils';
import { NormalizedSchema } from './normalized-schema';

export function addChildren(host: Tree, options: NormalizedSchema) {
  const { npmScope } = getWorkspaceLayout(host);
  const moduleSource = host.read(options.parentModule)!.toString('utf-8');
  const sourceFile = ts.createSourceFile(
    options.parentModule,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );
  const constName = `${names(options.fileName).propertyName}Routes`;
  const importPath = `@${npmScope}/${options.projectDirectory}`;

  addImportToModule(host, sourceFile, options.parentModule, options.moduleName);
  addRoute(
    host,
    options.parentModule,
    sourceFile,
    `{ path: '${names(options.fileName).fileName}', children: ${constName} }`
  );
  insertImport(
    host,
    sourceFile,
    options.parentModule,
    `${options.moduleName}, ${constName}`,
    importPath
  );
}
