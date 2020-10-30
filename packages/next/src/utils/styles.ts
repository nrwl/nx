import { noop, Rule } from '@angular-devkit/schematics';
import { addDepsToPackageJson } from '@nrwl/workspace';
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
      'emotion-server': emotionServerVersion,
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

export function addStyleDependencies(style: string): Rule {
  const extraDependencies = NEXT_SPECIFIC_STYLE_DEPENDENCIES[style];
  return extraDependencies
    ? addDepsToPackageJson(
        extraDependencies.dependencies,
        extraDependencies.devDependencies
      )
    : noop();
}
