import {
  emotionVersion,
  styledComponentsVersion,
  styledComponentsTypesVersion
} from './versions';
import { PackageDependencies } from './dependencies';

export const CSS_IN_JS_DEPENDENCIES: {
  [style: string]: PackageDependencies;
} = {
  'styled-components': {
    dependencies: {
      'styled-components': styledComponentsVersion
    },
    devDependencies: {
      '@types/styled-components': styledComponentsTypesVersion
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
