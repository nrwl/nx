import type { Tree } from '@nrwl/devkit';
import { logger, readProjectConfiguration, stripIndents } from '@nrwl/devkit';
import { getComponentFileInfo } from '../../utils/file-info';
import { locateLibraryEntryPointFromDirectory } from '../../utils/entry-point';
import { getRelativeImportToFile } from '../../utils/path';
import type { NormalizedSchema } from '../schema';
import { shouldExportInEntryPoint } from './entry-point';
import { findModuleFromOptions } from './module';

export function exportComponentInEntryPoint(
  tree: Tree,
  schema: NormalizedSchema
): void {
  if (!schema.export || (schema.skipImport && !schema.standalone)) {
    return;
  }

  const { root, projectType } = readProjectConfiguration(tree, schema.project);

  if (projectType === 'application') {
    return;
  }

  const { directory, filePath } = getComponentFileInfo(tree, schema);

  const entryPointPath = locateLibraryEntryPointFromDirectory(
    tree,
    directory,
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
    filePath
  );
  const updateEntryPointContent = stripIndents`${tree.read(
    entryPointPath,
    'utf-8'
  )}
    export * from "${relativePathFromEntryPoint}";`;

  tree.write(entryPointPath, updateEntryPointContent);
}
