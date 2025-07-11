import {
  joinPathFragments,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';

export function getUiFramework(
  tree: Tree,
  project: string
): '@storybook/react-vite' | '@storybook/react-webpack5' {
  const projectConfig = readProjectConfiguration(tree, project);

  if (
    findWebpackConfig(tree, projectConfig.root) ||
    projectConfig.targets?.['build']?.executor === '@nx/rollup:rollup' ||
    projectConfig.targets?.['build']?.executor === '@nx/expo:build'
  ) {
    return '@storybook/react-webpack5';
  }

  return '@storybook/react-vite';
}

function findWebpackConfig(
  tree: Tree,
  projectRoot: string
): string | undefined {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    const webpackConfigPath = joinPathFragments(
      projectRoot,
      `webpack.config.${ext}`
    );
    if (tree.exists(webpackConfigPath)) {
      return webpackConfigPath;
    }
  }
}
