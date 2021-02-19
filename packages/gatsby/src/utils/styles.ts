import { CSS_IN_JS_DEPENDENCIES } from '@nrwl/react';
import {
  gatsbyPluginEmotionVersion,
  gatsbyPluginLessVersion,
  gatsbyPluginSassVersion,
  gatsbyPluginStyledComponentsVersion,
  gatsbyPluginStylusVersion,
  nodeSassVersion,
} from './versions';
import { Tree } from '@nrwl/tao/src/shared/tree';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  updateJson,
} from '@nrwl/devkit';
import { detectPackageManager } from '@nrwl/tao/src/shared/package-manager';

export const GATSBY_SPECIFIC_STYLE_DEPENDENCIES = {
  'styled-components': {
    dependencies: CSS_IN_JS_DEPENDENCIES['styled-components'].dependencies,
    devDependencies: {
      'gatsby-plugin-styled-components': gatsbyPluginStyledComponentsVersion,
    },
  },
  '@emotion/styled': {
    dependencies: CSS_IN_JS_DEPENDENCIES['@emotion/styled'].dependencies,
    devDependencies: {
      'gatsby-plugin-emotion': gatsbyPluginEmotionVersion,
    },
  },
  scss: {
    dependencies: {},
    devDependencies: {
      'node-sass': nodeSassVersion,
      'gatsby-plugin-sass': gatsbyPluginSassVersion,
    },
  },
  less: {
    dependencies: {},
    devDependencies: {
      'gatsby-plugin-less': gatsbyPluginLessVersion,
    },
  },
  styl: {
    dependencies: {},
    devDependencies: {
      'gatsby-plugin-stylus': gatsbyPluginStylusVersion,
    },
  },
};

export function addStyleDependencies(host: Tree, style: string) {
  let installTask: GeneratorCallback;

  const extraDependencies = GATSBY_SPECIFIC_STYLE_DEPENDENCIES[style];

  if (!extraDependencies) return () => {};

  installTask = addDependenciesToPackageJson(
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
