import type { Tree } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import type { StringLiteral } from 'typescript';
import { getRelativeImportToFile } from '../../utils/path';

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
