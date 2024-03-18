import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import type { NormalizedSchema } from './normalized-schema';

export function setGeneratorDefaults(
  tree: Tree,
  options: NormalizedSchema
): void {
  const nxJson = readNxJson(tree);

  nxJson.generators = nxJson.generators ?? {};
  nxJson.generators['@nx/angular:application'] = {
    e2eTestRunner: options.e2eTestRunner,
    linter: options.linter,
    style: options.style,
    unitTestRunner: options.unitTestRunner,
    ...(nxJson.generators['@nx/angular:application'] || {}),
  };

  updateNxJson(tree, nxJson);
}
