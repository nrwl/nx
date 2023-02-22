import type { Tree } from '@nrwl/devkit';
import type { StringLiteral } from 'typescript';
import { getRelativeImportToFile } from '../../utils/path';
import { ensureTypescript } from '@nrwl/js/src/utils/typescript/ensure-typescript';

export function shouldExportInEntryPoint(
  tree: Tree,
  entryPoint: string,
  modulePath: string
): boolean {
  if (!modulePath) {
    return false;
  }

  ensureTypescript();
  const { tsquery } = require('@phenomnomnominal/tsquery');
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
