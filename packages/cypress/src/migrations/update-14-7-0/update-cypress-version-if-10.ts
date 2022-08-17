import { installedCypressVersion } from '../../utils/cypress-version';
import { cypressVersion } from '../../utils/versions';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  Tree,
} from '@nrwl/devkit';

export function updateCypressVersionIf10(tree: Tree): GeneratorCallback {
  const installedVersion = installedCypressVersion();
  const ngComponentTestingVersion = '^10.5.0';

  return installedVersion === 10
    ? addDependenciesToPackageJson(
        tree,
        {},
        { cypress: ngComponentTestingVersion }
      )
    : () => {};
}

export default updateCypressVersionIf10;
