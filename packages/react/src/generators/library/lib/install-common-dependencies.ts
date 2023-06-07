import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { addSwcDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';
import {
  babelPresetReactVersion,
  lessVersion,
  reactDomVersion,
  reactVersion,
  sassVersion,
  stylusVersion,
} from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export function installCommonDependencies(
  host: Tree,
  options: NormalizedSchema
) {
  const tasks: GeneratorCallback[] = [];
  const devDependencies = {};

  // Vite requires style preprocessors to be installed manually.
  // `@nx/webpack` installs them automatically for now.
  // TODO(jack): Once we clean up webpack we can remove this check
  if (options.bundler === 'vite' || options.unitTestRunner === 'vitest') {
    switch (options.style) {
      case 'scss':
        devDependencies['sass'] = sassVersion;
        break;
      case 'less':
        devDependencies['less'] = lessVersion;
        break;
      case 'styl': // @TODO(17): deprecated, going to be removed in Nx 17
        devDependencies['stylus'] = stylusVersion;
        break;
    }
  }

  const baseInstallTask = addDependenciesToPackageJson(
    host,
    {
      react: reactVersion,
      'react-dom': reactDomVersion,
    },
    devDependencies
  );
  tasks.push(baseInstallTask);

  if (options.compiler === 'swc') {
    tasks.push(addSwcDependencies(host));
  } else if (options.compiler === 'babel') {
    tasks.push(
      addDependenciesToPackageJson(
        host,
        {},
        { '@babel/preset-react': babelPresetReactVersion }
      )
    );
  }

  return runTasksInSerial(...tasks);
}
