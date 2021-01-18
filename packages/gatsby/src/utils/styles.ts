import { noop, Rule } from '@angular-devkit/schematics';
import { addDepsToPackageJson } from '@nrwl/workspace';
import { CSS_IN_JS_DEPENDENCIES } from '@nrwl/react';
import {
  gatsbyPluginStyledComponentsVersion,
  gatsbyPluginEmotionVersion,
  gatsbyPluginLessVersion,
  nodeSassVersion,
  gatsbyPluginSassVersion,
  gatsbyPluginStylusVersion,
} from './versions';

export const NEXT_SPECIFIC_STYLE_DEPENDENCIES = {
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

export function addStyleDependencies(style: string): Rule {
  const extraDependencies = NEXT_SPECIFIC_STYLE_DEPENDENCIES[style];
  return extraDependencies
    ? addDepsToPackageJson(
        extraDependencies.dependencies,
        extraDependencies.devDependencies
      )
    : noop();
}
