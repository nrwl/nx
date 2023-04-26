import { addDependenciesToPackageJson, getProjects, Tree } from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
export function installWebpackRollupDependencies(tree: Tree) {
  const projects = getProjects(tree);
  let shouldInstall = false;

  for (const [, project] of projects) {
    if (
      project.targets?.build?.executor === '@nrwl/webpack:webpack' ||
      project.targets?.build?.executor === '@nrwl/rollup:rollup' ||
      project.targets?.build?.executor === '@nrwl/web:rollup'
    ) {
      shouldInstall = true;
      break;
    }
  }

  if (shouldInstall) {
    // These were previously dependencies of `@nrwl/react` but we've removed them
    // to accommodate different bundlers and test runners.
    return addDependenciesToPackageJson(
      tree,
      {},
      {
        '@babel/preset-react': '^7.14.5',
        '@pmmmwh/react-refresh-webpack-plugin': '^0.5.7',
        '@svgr/webpack': '^6.1.2',
        'css-loader': '^6.4.0',
        'react-refresh': '^0.10.0',
        'style-loader': '^3.3.0',
        stylus: '^0.55.0',
        'stylus-loader': '^7.1.0',
        'url-loader': '^4.1.1',
        webpack: '^5.75.0',
        'webpack-merge': '^5.8.0',
        '@nrwl/webpack': nxVersion,
      }
    );
  }
}

export default installWebpackRollupDependencies;
