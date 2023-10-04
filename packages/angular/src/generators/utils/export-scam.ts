import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  logger,
  names,
  readProjectConfiguration,
  stripIndents,
} from '@nx/devkit';
import { locateLibraryEntryPointFromDirectory } from './entry-point';
import { getRelativeImportToFile } from './path';

export type GenerationOptions = {
  directory: string;
  filePath: string;
  name: string;
  project: string;
  export?: boolean;
  inlineScam?: boolean;
};

export function exportScam(tree: Tree, options: GenerationOptions): void {
  if (!options.export) {
    return;
  }

  const { projectType, root, sourceRoot } = readProjectConfiguration(
    tree,
    options.project
  );
  const projectSourceRoot = sourceRoot ?? joinPathFragments(root, 'src');

  if (projectType === 'application') {
    logger.warn(
      '--export=true was ignored as the project the SCAM is being generated in is not a library.'
    );

    return;
  }

  const entryPointPath = locateLibraryEntryPointFromDirectory(
    tree,
    options.directory,
    root,
    projectSourceRoot
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
    options.filePath
  );
  const entryPointContent = tree.read(entryPointPath, 'utf-8');
  let updatedEntryPointContent = stripIndents`${entryPointContent}
    export * from "${relativePathFromEntryPoint}";`;

  if (!options.inlineScam) {
    const moduleFilePath = joinPathFragments(
      options.directory,
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
