import { generateFiles, joinPathFragments, names, Tree } from '@nrwl/devkit';
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
      tmpl: '',
    }
  );

  if (options.skipModule) {
    tree.delete(
      joinPathFragments(
        options.entryPointDestination,
        `src/lib/${nameVariants.fileName}.module.ts`
      )
    );
  }
}
