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
    // Pinning `none` would freeze the answer detection exists to give, so a
    // workspace that adopts a linter later would keep getting none.
    linter: options.linter === 'none' ? undefined : options.linter,
    style: options.style,
    unitTestRunner: options.unitTestRunner,
    strict: !options.strict ? false : undefined,
    ...(nxJson.generators['@nx/angular:application'] || {}),
  };

  updateNxJson(tree, nxJson);
}
