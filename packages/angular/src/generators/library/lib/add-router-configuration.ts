import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, names } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import * as ts from 'typescript';
import { addImportToModule } from '../../../utils/nx-devkit/ast-utils';
import { NormalizedSchema } from './normalized-schema';
import { dirname } from 'path';

export function addRouterConfiguration(
  tree: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  const constName = `${names(options.fileName).propertyName}Routes`;
  const moduleSource = tree.read(options.modulePath, 'utf-8');
  let moduleSourceFile = ts.createSourceFile(
    options.modulePath,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );

  moduleSourceFile = addImportToModule(
    tree,
    moduleSourceFile,
    options.modulePath,
    `RouterModule`
  );
  moduleSourceFile = insertImport(
    tree,
    moduleSourceFile,
    options.modulePath,
    'RouterModule, Route',
    '@angular/router'
  );
  moduleSourceFile = insertImport(
    tree,
    moduleSourceFile,
    options.modulePath,
    constName,
    './lib.routes'
  );

  tree.write(
    joinPathFragments(dirname(options.modulePath), 'lib.routes.ts'),
    `import { Route } from '@angular/router';

export const ${constName}: Route[] = [];`
  );

  const pathToIndex = joinPathFragments(options.projectRoot, 'src/index.ts');
  const indexFileContents = tree.read(pathToIndex, 'utf-8');
  tree.write(
    pathToIndex,
    `${indexFileContents}
  export * from './lib/lib.routes';`
  );
}
