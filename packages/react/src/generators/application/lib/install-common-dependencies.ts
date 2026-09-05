import {
  addDependenciesToPackageJson,
  detectPackageManager,
  Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
import {
  babelCoreVersion,
  babelPresetReactVersion,
  sassVersion,
  swcLoaderVersion,
  testingLibraryReactVersion,
  testingLibraryDomVersion,
  tsLibVersion,
  typesNodeVersion,
  reactRouterIsBotVersion,
} from '../../../utils/versions';
import { NormalizedSchema } from '../schema';
import { getReactDependenciesVersionsToInstall } from '../../../utils/version-utils';

export async function installCommonDependencies(
  host: Tree,
  options: NormalizedSchema
) {
  if (options.skipPackageJson) {
    return () => {};
  }

  const reactDeps = await getReactDependenciesVersionsToInstall(host);

  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {
    '@types/react': reactDeps['@types/react'],
    '@types/react-dom': reactDeps['@types/react-dom'],
    '@types/node': typesNodeVersion,
    ...(options.useReactRouter
      ? {
          '@react-router/dev': reactDeps['react-router'],
        }
      : {}),
  };

  if (options.bundler !== 'vite') {
    dependencies['tslib'] = tsLibVersion;
  }

  if (options.useReactRouter) {
    dependencies['react-router'] = reactDeps['react-router'];
    dependencies['@react-router/node'] = reactDeps['react-router'];
    dependencies['@react-router/serve'] = reactDeps['react-router'];
    dependencies['isbot'] = reactRouterIsBotVersion;
  }

  // Vite requires style preprocessors to be installed manually.
  // `@nx/webpack` installs them automatically for now.
  if (options.bundler === 'vite' || options.unitTestRunner === 'vitest') {
    if (options.style === 'scss') {
      // sass pulls in @parcel/watcher, whose install script only builds from
      // source when npm_config_build_from_source is set.
      acknowledgeBuildScripts(host, detectPackageManager(host.root), {
        '@parcel/watcher': false,
      });
      devDependencies['sass'] = sassVersion;
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
    devDependencies['@testing-library/dom'] = testingLibraryDomVersion;
  }

  return addDependenciesToPackageJson(
    host,
    dependencies,
    devDependencies,
    undefined,
    true
  );
}
