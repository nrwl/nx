import type { Tree } from '@nx/devkit';
import { generateFiles, joinPathFragments, names } from '@nx/devkit';
import type { NormalizedNgRxFeatureStoreGeneratorOptions } from './normalize-options';
import { lt } from 'semver';

export function generateFilesFromTemplates(
  tree: Tree,
  options: NormalizedNgRxFeatureStoreGeneratorOptions
) {
  const projectNames = names(options.name);
  const fileName = options.subdirectory
    ? joinPathFragments(options.subdirectory, projectNames.fileName)
    : projectNames.fileName;

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files'),
    options.parentDirectory,
    {
      ...options,
      ...projectNames,
      fileName,
      relativeFileName: projectNames.fileName,
      importFromOperators: lt(options.rxjsVersion, '7.2.0'),
      tmpl: '',
    }
  );

  if (!options.facade) {
    tree.delete(
      joinPathFragments(
        options.parentDirectory,
        options.directory,
        `${options.subdirectory ? `${options.subdirectory}/` : ''}${
          projectNames.fileName
        }.facade.ts`
      )
    );
    tree.delete(
      joinPathFragments(
        options.parentDirectory,
        options.directory,
        `${options.subdirectory ? `${options.subdirectory}/` : ''}${
          projectNames.fileName
        }.facade.spec.ts`
      )
    );
  }
}
