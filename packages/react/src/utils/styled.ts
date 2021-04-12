import {
  babelPluginStyledComponentsVersion,
  emotionBabelPlugin,
  emotionReactVersion,
  emotionStyledVersion,
  reactIsVersion,
  styledComponentsVersion,
  styledJsxVersion,
  typesReactIsVersion,
  typesStyledComponentsVersion,
  typesStyledJsxVersion,
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
      '@emotion/react': emotionReactVersion,
    },
    devDependencies: {
      '@emotion/babel-plugin': emotionBabelPlugin,
    },
  },
  'styled-jsx': {
    dependencies: {
      'styled-jsx': styledJsxVersion,
    },
    devDependencies: {
      '@types/styled-jsx': typesStyledJsxVersion,
    },
  },
};
