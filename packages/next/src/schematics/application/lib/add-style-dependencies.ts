import { noop, Rule } from '@angular-devkit/schematics';
import { CSS_IN_JS_DEPENDENCIES } from '@nrwl/react';
import { addDepsToPackageJson } from '@nrwl/workspace';
import { NormalizedSchema } from './normalize-options';
import {
  zeitNextCss,
  zeitNextLess,
  zeitNextSass,
  zeitNextStylus,
  nodeSass
} from '../../../utils/versions';

const NEXT_SPECIFIC_STYLE_DEPENDENCIES = {
  ...CSS_IN_JS_DEPENDENCIES,
  css: {
    dependencies: {
      '@zeit/next-css': zeitNextCss
    },
    devDependencies: {
      'node-sass': nodeSass
    }
  },
  scss: {
    dependencies: {
      '@zeit/next-sass': zeitNextSass
    },
    devDependencies: {}
  },
  less: {
    dependencies: {
      '@zeit/next-less': zeitNextLess
    },
    devDependencies: {}
  },
  styl: {
    dependencies: {
      '@zeit/next-stylus': zeitNextStylus
    },
    devDependencies: {}
  }
};

export function addStyleDependencies(options: NormalizedSchema): Rule {
  const extraDependencies = NEXT_SPECIFIC_STYLE_DEPENDENCIES[options.style];
  return extraDependencies
    ? addDepsToPackageJson(
        extraDependencies.dependencies,
        extraDependencies.devDependencies
      )
    : noop();
}
