import {
  babelPluginStyledComponentsVersion,
  emotionBabelPlugin,
  emotionReactVersion,
  emotionStyledVersion,
  reactIsVersion,
  styledComponentsVersion,
  styledJsxVersion,
  swcPluginEmotionVersion,
  swcPluginStyledComponentsVersion,
  swcPluginStyledJsxVersion,
  typesReactIsVersion,
  typesStyledComponentsVersion,
} from './versions';
import { PackageDependencies } from './dependencies';

export const cssInJsDependenciesBabel: Record<string, PackageDependencies> = {
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
    devDependencies: {},
  },
};

export const cssInJsDependenciesSwc: Record<string, PackageDependencies> = {
  'styled-components': {
    dependencies: {
      'react-is': reactIsVersion,
      'styled-components': styledComponentsVersion,
    },
    devDependencies: {
      '@types/styled-components': typesStyledComponentsVersion,
      '@types/react-is': typesReactIsVersion,
      '@swc/plugin-styled-components': swcPluginStyledComponentsVersion,
    },
  },
  '@emotion/styled': {
    dependencies: {
      '@emotion/styled': emotionStyledVersion,
      '@emotion/react': emotionReactVersion,
    },
    devDependencies: {
      '@swc/plugin-emotion': swcPluginEmotionVersion,
    },
  },
  'styled-jsx': {
    dependencies: {
      'styled-jsx': styledJsxVersion,
    },
    devDependencies: {
      '@swc/plugin-styled-jsx': swcPluginStyledJsxVersion,
    },
  },
};
