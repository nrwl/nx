import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import type { NormalizedSchema } from './normalized-schema';

export function setGeneratorDefaults(
  tree: Tree,
  options: NormalizedSchema
): void {
  const nxJson = readNxJson(tree);

  nxJson.generators = nxJson.generators ?? {};
  nxJson.generators['@nx/angular:library'] = {
    linter: options.libraryOptions.linter,
    unitTestRunner: options.libraryOptions.unitTestRunner,
    ...(nxJson.generators['@nx/angular:library'] || {}),
  };

  updateNxJson(tree, nxJson);
}
