import { generateFiles, joinPathFragments, names, Tree } from '@nx/devkit';
import { NormalizedGeneratorOptions } from '../schema';

export function addFiles(
  tree: Tree,
  options: NormalizedGeneratorOptions
): void {
  const nameVariants = names(options.name);

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files'),
    options.entryPointDestination,
    {
      ...options,
      ...nameVariants,
      moduleTypeSeparator: options.moduleTypeSeparator,
      tmpl: '',
    }
  );

  if (options.usesPackageExports) {
    tree.delete(
      joinPathFragments(options.entryPointDestination, 'ng-package.json')
    );
  }

  if (options.skipModule) {
    tree.delete(
      joinPathFragments(
        options.entryPointDestination,
        `src/lib/${nameVariants.fileName}${options.moduleTypeSeparator}module.ts`
      )
    );
  }
}
