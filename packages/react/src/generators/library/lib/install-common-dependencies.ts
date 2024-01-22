import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { addSwcDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';
import {
  babelCoreVersion,
  babelPresetReactVersion,
  lessVersion,
  sassVersion,
  testingLibraryReactVersion,
  tsLibVersion,
  typesNodeVersion,
  typesReactDomVersion,
  typesReactVersion,
} from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export function installCommonDependencies(
  host: Tree,
  options: NormalizedSchema
) {
  const tasks: GeneratorCallback[] = [];

  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {
    '@types/node': typesNodeVersion,
    '@types/react': typesReactVersion,
    '@types/react-dom': typesReactDomVersion,
  };

  if (options.bundler !== 'vite') {
    dependencies['tslib'] = tsLibVersion;
  }

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
    }
  }

  if (options.unitTestRunner && options.unitTestRunner !== 'none') {
    devDependencies['@testing-library/react'] = testingLibraryReactVersion;
  }

  const baseInstallTask = addDependenciesToPackageJson(
    host,
    dependencies,
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
        {
          '@babel/preset-react': babelPresetReactVersion,
          '@babel/core': babelCoreVersion,
        }
      )
    );
  }

  return runTasksInSerial(...tasks);
}
