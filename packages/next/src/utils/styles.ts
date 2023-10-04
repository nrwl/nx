import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  Tree,
  updateJson,
} from '@nx/devkit';

import { lessVersion, stylusVersion } from '@nx/react/src/utils/versions';
import {
  cssInJsDependenciesBabel,
  cssInJsDependenciesSwc,
} from '@nx/react/src/utils/styled';
import {
  babelPluginStyledComponentsVersion,
  emotionServerVersion,
  lessLoader,
  sassVersion,
  stylusLoader,
} from './versions';

const nextSpecificStyleDependenciesCommon = {
  css: {
    dependencies: {},
    devDependencies: {},
  },
  scss: {
    dependencies: {},
    devDependencies: { sass: sassVersion },
  },
  less: {
    dependencies: {},
    devDependencies: {
      less: lessVersion,
      'less-loader': lessLoader,
    },
  },
  styl: {
    dependencies: {
      stylus: stylusVersion,
      'stylus-loader': stylusLoader,
    },
    devDependencies: {},
  },
};

export const nextSpecificStyleDependenciesBabel = {
  ...nextSpecificStyleDependenciesCommon,
  'styled-components': {
    dependencies: cssInJsDependenciesBabel['styled-components'].dependencies,
    devDependencies: {
      ...cssInJsDependenciesBabel['styled-components'].devDependencies,
      'babel-plugin-styled-components': babelPluginStyledComponentsVersion,
    },
  },
  '@emotion/styled': {
    dependencies: {
      ...cssInJsDependenciesBabel['@emotion/styled'].dependencies,
      '@emotion/server': emotionServerVersion,
    },
    devDependencies:
      cssInJsDependenciesBabel['@emotion/styled'].devDependencies,
  },
};

export const nextSpecificStyleDependenciesSwc = {
  ...nextSpecificStyleDependenciesCommon,
  'styled-components': {
    dependencies: cssInJsDependenciesSwc['styled-components'].dependencies,
    devDependencies: {
      ...cssInJsDependenciesSwc['styled-components'].devDependencies,
      'babel-plugin-styled-components': babelPluginStyledComponentsVersion,
    },
  },
  '@emotion/styled': {
    dependencies: {
      ...cssInJsDependenciesSwc['@emotion/styled'].dependencies,
      '@emotion/server': emotionServerVersion,
    },
    devDependencies: cssInJsDependenciesSwc['@emotion/styled'].devDependencies,
  },
};

export function addStyleDependencies(
  host: Tree,
  options: { style?: string; swc?: boolean }
): GeneratorCallback {
  const extraDependencies = options.swc
    ? nextSpecificStyleDependenciesSwc[options.style]
    : nextSpecificStyleDependenciesBabel[options.style];

  if (!extraDependencies) return () => {};

  const installTask = addDependenciesToPackageJson(
    host,
    extraDependencies.dependencies,
    extraDependencies.devDependencies
  );

  // @zeit/next-less & @zeit/next-stylus internal configuration is working only
  // for specific CSS loader version, causing PNPM resolution to fail.
  if (
    host.exists('pnpm-lock.yaml') &&
    (options.style === 'less' || options.style === 'styl')
  ) {
    updateJson(host, `package.json`, (json) => {
      json.resolutions = { ...json.resolutions, 'css-loader': '1.0.1' };
      return json;
    });
  }

  return installTask;
}
