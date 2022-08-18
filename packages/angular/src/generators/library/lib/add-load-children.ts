import { names, Tree } from '@nrwl/devkit';
import * as ts from 'typescript';
import { addRoute } from '../../../utils/nx-devkit/ast-utils';
import { NormalizedSchema } from './normalized-schema';

export function addLoadChildren(host: Tree, options: NormalizedSchema) {
  if (!host.exists(options.parentModule)) {
    throw new Error(`Cannot find '${options.parentModule}'`);
  }

  const moduleSource = host.read(options.parentModule)!.toString('utf-8');
  const sourceFile = ts.createSourceFile(
    options.parentModule,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );

  addRoute(
    host,
    options.parentModule,
    sourceFile,
    `{path: '${
      names(options.fileName).fileName
    }', loadChildren: () => import('${options.importPath}').then(m => m.${
      options.standalone
        ? `${names(options.name).className.toUpperCase()}_ROUTES`
        : options.moduleName
    })}`
  );
}
