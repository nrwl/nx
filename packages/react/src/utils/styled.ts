import {
  emotionVersion,
  styledComponentVersion,
  styledComponentTypesVersion
} from './versions';
import { PackageDependencies } from './dependencies';

export const CSS_IN_JS_DEPENDENCIES: {
  [style: string]: PackageDependencies;
} = {
  'styled-components': {
    dependencies: {
      'styled-components': styledComponentVersion
    },
    devDependencies: {
      '@types/styled-components': styledComponentTypesVersion
    }
  },
  '@emotion/styled': {
    dependencies: {
      '@emotion/styled': emotionVersion,
      '@emotion/core': emotionVersion
    },
    devDependencies: {}
  }
};
