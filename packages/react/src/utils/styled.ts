import {
  emotionCoreVersion,
  emotionStyledVersion,
  styledComponentsVersion,
  typesStyledComponentsVersion,
} from './versions';
import { PackageDependencies } from './dependencies';

export const CSS_IN_JS_DEPENDENCIES: {
  [style: string]: PackageDependencies;
} = {
  'styled-components': {
    dependencies: {
      'styled-components': styledComponentsVersion,
    },
    devDependencies: {
      '@types/styled-components': typesStyledComponentsVersion,
    },
  },
  '@emotion/styled': {
    dependencies: {
      '@emotion/styled': emotionStyledVersion,
      '@emotion/core': emotionCoreVersion,
    },
    devDependencies: {},
  },
};
