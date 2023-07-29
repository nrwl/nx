import type { Tree } from '@nx/devkit';
import { logger, readProjectConfiguration, stripIndents } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import type { StringLiteral } from 'typescript';
import { locateLibraryEntryPointFromDirectory } from '../../utils/entry-point';
import { getRelativeImportToFile } from '../../utils/path';
import type { NormalizedSchema } from '../schema';
import { findModuleFromOptions } from './module';

export function exportComponentInEntryPoint(
  tree: Tree,
  schema: NormalizedSchema
): void {
  if (!schema.export || schema.skipImport) {
    return;
  }

  const { root, projectType } = readProjectConfiguration(tree, schema.project);

  if (projectType === 'application') {
    return;
  }

  const entryPointPath = locateLibraryEntryPointFromDirectory(
    tree,
    schema.directory,
    root,
    schema.projectSourceRoot
  );
  if (!entryPointPath) {
    logger.warn(
      `Unable to determine whether the component should be exported in the library entry point file. ` +
        `The library's entry point file could not be found. Skipping exporting the component in the entry point file.`
    );

    return;
  }

  if (!schema.standalone) {
    const modulePath = findModuleFromOptions(tree, schema, root);
    if (!shouldExportInEntryPoint(tree, entryPointPath, modulePath)) {
      return;
    }
  }

  const relativePathFromEntryPoint = getRelativeImportToFile(
    entryPointPath,
    schema.filePath
  );
  const updateEntryPointContent = stripIndents`${tree.read(
    entryPointPath,
    'utf-8'
  )}
    export * from "${relativePathFromEntryPoint}";`;

  tree.write(entryPointPath, updateEntryPointContent);
}

function shouldExportInEntryPoint(
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
