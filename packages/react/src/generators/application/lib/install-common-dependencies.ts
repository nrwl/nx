import { addDependenciesToPackageJson, Tree } from '@nrwl/devkit';
import {
  lessVersion,
  sassVersion,
  stylusVersion,
} from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export function installCommonDependencies(
  host: Tree,
  options: NormalizedSchema
) {
  let devDependencies = null;

  // Vite requires style preprocessors to be installed manually.
  // `@nrwl/webpack` installs them automatically for now.
  // TODO(jack): Once we clean up webpack we can remove this check
  if (options.bundler === 'vite' || options.unitTestRunner === 'vitest') {
    switch (options.style) {
      case 'scss':
        devDependencies = { sass: sassVersion };
        break;
      case 'less':
        devDependencies = { less: lessVersion };
        break;
      case 'styl': // @TODO(17): deprecated, going to be removed in Nx 17
        devDependencies = { stylus: stylusVersion };
        break;
    }
  }

  return devDependencies
    ? addDependenciesToPackageJson(host, {}, devDependencies)
    : function noop() {};
}
