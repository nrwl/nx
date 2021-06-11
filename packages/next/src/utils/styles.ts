import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  Tree,
  updateJson,
} from '@nrwl/devkit';

import { CSS_IN_JS_DEPENDENCIES } from '@nrwl/react';
import {
  babelPluginStyledComponentsVersion,
  emotionServerVersion,
  nodeSass,
  zeitNextLess,
  zeitNextStylus,
} from './versions';

export const NEXT_SPECIFIC_STYLE_DEPENDENCIES = {
  'styled-components': {
    dependencies: CSS_IN_JS_DEPENDENCIES['styled-components'].dependencies,
    devDependencies: {
      ...CSS_IN_JS_DEPENDENCIES['styled-components'].devDependencies,
      'babel-plugin-styled-components': babelPluginStyledComponentsVersion,
    },
  },
  '@emotion/styled': {
    dependencies: {
      ...CSS_IN_JS_DEPENDENCIES['@emotion/styled'].dependencies,
      '@emotion/server': emotionServerVersion,
    },
    devDependencies: CSS_IN_JS_DEPENDENCIES['@emotion/styled'].devDependencies,
  },
  css: {
    dependencies: {},
    devDependencies: {},
  },
  scss: {
    dependencies: {},
    devDependencies: {
      'node-sass': nodeSass,
    },
  },
  less: {
    dependencies: {
      '@zeit/next-less': zeitNextLess,
    },
    devDependencies: {},
  },
  styl: {
    dependencies: {
      '@zeit/next-stylus': zeitNextStylus,
    },
    devDependencies: {},
  },
};

export function addStyleDependencies(
  host: Tree,
  style: string
): GeneratorCallback {
  const extraDependencies = NEXT_SPECIFIC_STYLE_DEPENDENCIES[style];

  if (!extraDependencies) return () => {};

  const installTask = addDependenciesToPackageJson(
    host,
    extraDependencies.dependencies,
    extraDependencies.devDependencies
  );

  // @zeit/next-less & @zeit/next-stylus internal configuration is working only
  // for specific CSS loader version, causing PNPM resolution to fail.
  if (host.exists('pnpm-lock.yaml') && (style === 'less' || style === 'styl')) {
    updateJson(host, `package.json`, (json) => {
      json.resolutions = { ...json.resolutions, 'css-loader': '1.0.1' };
      return json;
    });
  }

  return installTask;
}
