import type { Tree } from '@nx/devkit';
import { generateFiles, joinPathFragments, names } from '@nx/devkit';
import { lt } from 'semver';
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
    joinPathFragments(__dirname, '..', 'files'),
    options.parentDirectory,
    {
      ...options,
      ...projectNames,
      importFromOperators: lt(options.rxjsVersion, '7.2.0'),
      isRxJs7: options.rxjsMajorVersion >= 7,
      tmpl: '',
    }
  );

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
