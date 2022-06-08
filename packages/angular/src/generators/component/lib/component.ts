import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  logger,
  names,
  normalizePath,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  stripIndents,
} from '@nrwl/devkit';
import type { Schema } from '../schema';
import {
  locateLibraryEntryPointFromDirectory,
  shouldExportInEntryPoint,
} from './entry-point';
import { findModuleFromOptions } from './module';
import { getRelativeImportToFile } from './path';

export function exportComponentInEntryPoint(tree: Tree, schema: Schema): void {
  if (!schema.export || (schema.skipImport && !schema.standalone)) {
    return;
  }

  const project =
    schema.project ?? readWorkspaceConfiguration(tree).defaultProject;

  const { root, sourceRoot, projectType } = readProjectConfiguration(
    tree,
    project
  );

  if (projectType === 'application') {
    return;
  }

  const componentNames = names(schema.name);

  const componentFileName = `${componentNames.fileName}.${
    schema.type ? names(schema.type).fileName : 'component'
  }`;

  const projectSourceRoot = sourceRoot ?? joinPathFragments(root, 'src');
  schema.path ??= joinPathFragments(projectSourceRoot, 'lib');
  const componentDirectory = schema.flat
    ? normalizePath(schema.path)
    : joinPathFragments(schema.path, componentNames.fileName);

  const componentFilePath = joinPathFragments(
    componentDirectory,
    `${componentFileName}.ts`
  );

  const entryPointPath = locateLibraryEntryPointFromDirectory(
    tree,
    componentDirectory,
    root,
    projectSourceRoot
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
    componentFilePath
  );
  const updateEntryPointContent = stripIndents`${tree.read(
    entryPointPath,
    'utf-8'
  )}
    export * from "${relativePathFromEntryPoint}";`;

  tree.write(entryPointPath, updateEntryPointContent);
}
