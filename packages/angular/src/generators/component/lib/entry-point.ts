import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, readJson } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { dirname } from 'path';
import type { StringLiteral } from 'typescript';
import { getRelativeImportToFile } from './path';

export function locateLibraryEntryPointFromDirectory(
  tree: Tree,
  directory: string,
  projectRoot: string,
  projectSourceRoot: string
): string | null {
  const ngPackageJsonPath = joinPathFragments(directory, 'ng-package.json');
  let entryPointFile = tree.exists(ngPackageJsonPath)
    ? readJson(tree, ngPackageJsonPath).lib?.entryFile
    : null;

  if (entryPointFile) {
    return joinPathFragments(directory, entryPointFile);
  }

  if (directory === projectRoot) {
    const indexFile = joinPathFragments(projectSourceRoot, 'index.ts');

    return tree.exists(indexFile) ? indexFile : null;
  }

  return locateLibraryEntryPointFromDirectory(
    tree,
    dirname(directory),
    projectRoot,
    projectSourceRoot
  );
}

export function shouldExportInEntryPoint(
  tree: Tree,
  entryPoint: string,
  modulePath: string
): boolean {
  if (!modulePath) {
    return false;
  }

  const moduleImportPath = getRelativeImportToFile(entryPoint, modulePath);
  const entryPointContent = tree.read(entryPoint, 'utf-8');
  const entryPointAst = tsquery.ast(entryPointContent);
  const moduleExport = tsquery(
    entryPointAst,
    `ExportDeclaration StringLiteral[value='${moduleImportPath}']`,
    { visitAllChildren: true }
  )[0] as StringLiteral;

  return Boolean(moduleExport);
}
