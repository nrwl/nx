import type { Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { getImportPath } from '@nx/js/src/utils/get-import-path';
import type { NxRemixGeneratorSchema } from '../schema';

export interface RemixLibraryOptions extends NxRemixGeneratorSchema {
  projectName: string;
  projectRoot: string;
}

export async function normalizeOptions(
  tree: Tree,
  options: NxRemixGeneratorSchema
): Promise<RemixLibraryOptions> {
  const { projectName, projectRoot, projectNameAndRootFormat } =
    await determineProjectNameAndRootOptions(tree, {
      name: options.name,
      projectType: 'library',
      directory: options.directory,
      projectNameAndRootFormat: options.projectNameAndRootFormat,
      callingGenerator: '@nx/remix:library',
    });

  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  const importPath = options.importPath ?? getImportPath(tree, projectRoot);

  return {
    ...options,
    unitTestRunner: options.unitTestRunner ?? 'vitest',
    importPath,
    projectName,
    projectRoot,
  };
}
