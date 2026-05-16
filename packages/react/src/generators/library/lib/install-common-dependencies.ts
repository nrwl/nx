import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { addSwcDependencies } from '@nx/js/internal';
import { getReactDependenciesVersionsToInstall } from '../../../utils/version-utils';
import {
  babelCoreVersion,
  babelPresetReactVersion,
  sassVersion,
  testingLibraryDomVersion,
  testingLibraryReactVersion,
  tsLibVersion,
  typesNodeVersion,
} from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export async function installCommonDependencies(
  host: Tree,
  options: NormalizedSchema
) {
  const tasks: GeneratorCallback[] = [];

  const reactVersions = await getReactDependenciesVersionsToInstall(host);

  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {
    '@types/node': typesNodeVersion,
    '@types/react': reactVersions['@types/react'],
    '@types/react-dom': reactVersions['@types/react-dom'],
  };

  if (options.bundler !== 'vite') {
    dependencies['tslib'] = tsLibVersion;
  }

  // Vite requires style preprocessors to be installed manually.
  // `@nx/webpack` installs them automatically for now.
  // TODO(jack): Once we clean up webpack we can remove this check
  if (options.bundler === 'vite' || options.unitTestRunner === 'vitest') {
    if (options.style === 'scss') {
      devDependencies['sass'] = sassVersion;
    }
  }

  if (options.unitTestRunner && options.unitTestRunner !== 'none') {
    devDependencies['@testing-library/react'] = testingLibraryReactVersion;
    devDependencies['@testing-library/dom'] = testingLibraryDomVersion;
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
