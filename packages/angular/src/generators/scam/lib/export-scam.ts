import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  logger,
  names,
  readProjectConfiguration,
  stripIndents,
} from '@nrwl/devkit';
import type { ComponentFileInfo } from '../../utils/component';
import { locateLibraryEntryPointFromDirectory } from '../../utils/entry-point';
import { getRelativeImportToFile } from '../../utils/path';
import type { NormalizedSchema } from '../schema';

export function exportScam(
  tree: Tree,
  { componentDirectory, componentFilePath }: ComponentFileInfo,
  options: NormalizedSchema
): void {
  if (!options.export) {
    return;
  }

  const { root, projectType } = readProjectConfiguration(tree, options.project);

  if (projectType === 'application') {
    logger.warn(
      '--export=true was ignored as the project the SCAM is being generated in is not a library.'
    );

    return;
  }

  const entryPointPath = locateLibraryEntryPointFromDirectory(
    tree,
    componentDirectory,
    root,
    options.projectSourceRoot
  );
  if (!entryPointPath) {
    // Let's not error, simply warn the user
    // It's not too much effort to manually do this
    // It would be more frustrating to have to find the correct path and re-run the command
    logger.warn(
      `Could not export SCAM. Unable to determine project's entry point. SCAM has still been created.`
    );

    return;
  }

  const relativePathFromEntryPoint = getRelativeImportToFile(
    entryPointPath,
    componentFilePath
  );
  const entryPointContent = tree.read(entryPointPath, 'utf-8');
  let updatedEntryPointContent = stripIndents`${entryPointContent}
    export * from "${relativePathFromEntryPoint}";`;

  if (!options.inlineScam) {
    const moduleFilePath = joinPathFragments(
      componentDirectory,
      `${names(options.name).fileName}.module.ts`
    );
    const relativePathFromModule = getRelativeImportToFile(
      entryPointPath,
      moduleFilePath
    );
    updatedEntryPointContent = stripIndents`${updatedEntryPointContent}
      export * from "${relativePathFromModule}";`;
  }

  tree.write(entryPointPath, updatedEntryPointContent);
}
