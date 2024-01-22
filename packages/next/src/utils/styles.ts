import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';

import { lessVersion } from '@nx/react/src/utils/versions';
import {
  cssInJsDependenciesBabel,
  cssInJsDependenciesSwc,
} from '@nx/react/src/utils/styled';
import {
  babelPluginStyledComponentsVersion,
  emotionServerVersion,
  lessLoader,
  sassVersion,
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

  return extraDependencies
    ? addDependenciesToPackageJson(
        host,
        extraDependencies.dependencies,
        extraDependencies.devDependencies
      )
    : () => {};
}
