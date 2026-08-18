import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import type { NormalizedSchema } from './normalized-schema';

export function setGeneratorDefaults(
  tree: Tree,
  options: NormalizedSchema
): void {
  const nxJson = readNxJson(tree);

  nxJson.generators = nxJson.generators ?? {};
  nxJson.generators['@nx/angular:library'] = {
    // Pinning `none` would freeze the answer detection exists to give, so a
    // workspace that adopts a linter later would keep getting none.
    linter:
      options.libraryOptions.linter === 'none'
        ? undefined
        : options.libraryOptions.linter,
    unitTestRunner: options.libraryOptions.unitTestRunner,
    strict: !options.libraryOptions.strict ? false : undefined,
    ...(nxJson.generators['@nx/angular:library'] || {}),
  };

  updateNxJson(tree, nxJson);
}
