import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  logger,
  names,
  readProjectConfiguration,
  stripIndents,
} from '@nrwl/devkit';
import { locateLibraryEntryPointFromDirectory } from './entry-point';
import type { FileInfo } from './file-info';
import { getRelativeImportToFile } from './path';

export type GenerationOptions = {
  name: string;
  project: string;
  export?: boolean;
  inlineScam?: boolean;
};

export function exportScam(
  tree: Tree,
  fileInfo: FileInfo,
  options: GenerationOptions
): void {
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
    fileInfo.directory,
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
    fileInfo.filePath
  );
  const entryPointContent = tree.read(entryPointPath, 'utf-8');
  let updatedEntryPointContent = stripIndents`${entryPointContent}
    export * from "${relativePathFromEntryPoint}";`;

  if (!options.inlineScam) {
    const moduleFilePath = joinPathFragments(
      fileInfo.directory,
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
