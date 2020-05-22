import {
  babelPluginStyledComponentsVersion,
  emotionBabelPresetCssPropVersion,
  emotionCoreVersion,
  emotionStyledVersion,
  reactIsVersion,
  styledComponentsVersion,
  typesReactIsVersion,
  typesStyledComponentsVersion,
} from './versions';
import { PackageDependencies } from './dependencies';

export const CSS_IN_JS_DEPENDENCIES: {
  [style: string]: PackageDependencies;
} = {
  'styled-components': {
    dependencies: {
      'react-is': reactIsVersion,
      'styled-components': styledComponentsVersion,
    },
    devDependencies: {
      '@types/styled-components': typesStyledComponentsVersion,
      '@types/react-is': typesReactIsVersion,
      'babel-plugin-styled-components': babelPluginStyledComponentsVersion,
    },
  },
  '@emotion/styled': {
    dependencies: {
      '@emotion/styled': emotionStyledVersion,
      '@emotion/core': emotionCoreVersion,
    },
    devDependencies: {
      '@emotion/babel-preset-css-prop': emotionBabelPresetCssPropVersion,
    },
  },
};
