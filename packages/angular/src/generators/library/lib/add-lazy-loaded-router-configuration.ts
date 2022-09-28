import { joinPathFragments, names, Tree } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import * as ts from 'typescript';
import { addImportToModule } from '../../../utils/nx-devkit/ast-utils';
import { NormalizedSchema } from './normalized-schema';
import { dirname } from 'path';

export function addLazyLoadedRouterConfiguration(
  tree: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  const constName = `${names(options.fileName).propertyName}Routes`;
  tree.write(
    joinPathFragments(dirname(options.modulePath), 'lib.routes.ts'),
    `import { Route } from '@angular/router';

export const ${constName}: Route[] = [/* {path: '', pathMatch: 'full', component: InsertYourComponentHere} */];`
  );

  const routeFileSource = tree.read(options.modulePath, 'utf-8');
  let sourceFile = ts.createSourceFile(
    options.modulePath,
    routeFileSource,
    ts.ScriptTarget.Latest,
    true
  );
  sourceFile = addImportToModule(
    tree,
    sourceFile,
    options.modulePath,
    `
    RouterModule.forChild(${constName}) `
  );

  sourceFile = insertImport(
    tree,
    sourceFile,
    options.modulePath,
    'RouterModule',
    '@angular/router'
  );
  sourceFile = insertImport(
    tree,
    sourceFile,
    options.modulePath,
    constName,
    './lib.routes'
  );

  const pathToIndex = joinPathFragments(options.projectRoot, 'src/index.ts');
  const indexFileContents = tree.read(pathToIndex, 'utf-8');
  tree.write(
    pathToIndex,
    `${indexFileContents}
  export * from './lib/lib.routes';`
  );
}
