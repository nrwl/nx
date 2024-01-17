import { addDependenciesToPackageJson, Tree } from '@nx/devkit';
import {
  babelCoreVersion,
  babelPresetReactVersion,
  lessVersion,
  sassVersion,
  swcLoaderVersion,
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
  if (options.skipPackageJson) {
    return () => {};
  }

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

  if (options.bundler === 'webpack') {
    if (options.compiler === 'swc') {
      devDependencies['swc-loader'] = swcLoaderVersion;
    } else if (options.compiler === 'babel') {
      // babel-loader is currently included in @nx/webpack
      // TODO(jack): Install babel-loader and other babel packages only as needed
      devDependencies['@babel/preset-react'] = babelPresetReactVersion;
      devDependencies['@babel/core'] = babelCoreVersion;
    }
  }

  if (options.unitTestRunner && options.unitTestRunner !== 'none') {
    devDependencies['@testing-library/react'] = testingLibraryReactVersion;
  }

  return addDependenciesToPackageJson(host, {}, devDependencies);
}
