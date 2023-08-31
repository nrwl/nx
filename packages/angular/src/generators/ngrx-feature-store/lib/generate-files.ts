import type { Tree } from '@nx/devkit';
import { generateFiles, joinPathFragments, names } from '@nx/devkit';
import type { NormalizedNgRxFeatureStoreGeneratorOptions } from './normalize-options';
import { lt } from 'semver';
import { getInstalledAngularVersion } from '../../utils/version-utils';

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
    joinPathFragments(__dirname, '..', 'files', 'base'),
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

  const angularVersion = getInstalledAngularVersion(tree);
  if (lt(angularVersion, '14.1.0')) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '..', 'files', 'no-inject'),
      options.parentDirectory,
      {
        ...options,
        ...projectNames,
        fileName,
        relativeFileName: projectNames.fileName,
        tmpl: '',
      }
    );
  }

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
