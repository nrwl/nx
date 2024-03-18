import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import type { NormalizedSchema } from '../schema';

export function setGeneratorDefaults(
  tree: Tree,
  options: NormalizedSchema
): void {
  const nxJson = readNxJson(tree);

  nxJson.generators = nxJson.generators ?? {};
  nxJson.generators['@nx/angular:component'] = {
    style: options.style,
    ...(nxJson.generators['@nx/angular:component'] || {}),
  };

  updateNxJson(tree, nxJson);
}
