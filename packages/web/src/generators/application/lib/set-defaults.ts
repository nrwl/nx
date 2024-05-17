import { Tree, readNxJson, updateNxJson } from '@nx/devkit';
import { NormalizedSchema } from '../schema';

export function setDefaults(tree: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(tree);
  nxJson.generators = nxJson.generators || {};
  nxJson.generators['@nx/web:application'] = {
    style: options.style,
    linter: options.linter,
    unitTestRunner: options.unitTestRunner,
    e2eTestRunner: options.e2eTestRunner,
    ...nxJson.generators['@nx/web:application'],
  };
  updateNxJson(tree, nxJson);
}
