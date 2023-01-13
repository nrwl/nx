import type { Tree } from '@nrwl/devkit';
import { generateFiles, joinPathFragments, names } from '@nrwl/devkit';
import { lt } from 'semver';
import { getInstalledAngularVersion } from '../../utils/angular-version-utils';
import { NormalizedNgRxGeneratorOptions } from './normalize-options';

/**
 * Generate 'feature' scaffolding: actions, reducer, effects, interfaces, selectors, facade
 */
export function generateNgrxFilesFromTemplates(
  tree: Tree,
  options: NormalizedNgRxGeneratorOptions
): void {
  const name = options.name;
  const projectNames = names(name);

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files', 'latest'),
    options.parentDirectory,
    {
      ...options,
      ...projectNames,
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
        tmpl: '',
      }
    );
  }

  if (!options.facade) {
    tree.delete(
      joinPathFragments(
        options.parentDirectory,
        options.directory,
        `${projectNames.fileName}.facade.ts`
      )
    );
    tree.delete(
      joinPathFragments(
        options.parentDirectory,
        options.directory,
        `${projectNames.fileName}.facade.spec.ts`
      )
    );
  }
}
