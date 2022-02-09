import type { Tree } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

export function getMfeProjects(tree: Tree) {
  const NRWL_WEBPACK_BROWSER_BUILDER = '@nrwl/angular:webpack-browser';
  const CUSTOM_WEBPACK_OPTION = 'customWebpackConfig';

  const projects: string[] = [];
  forEachExecutorOptions(
    tree,
    NRWL_WEBPACK_BROWSER_BUILDER,
    (opts, projectName) => {
      const webpackPath = opts[CUSTOM_WEBPACK_OPTION]?.path;
      if (!webpackPath || !tree.exists(webpackPath)) {
        return;
      }
      const webpackConfig = tree.read(webpackPath, 'utf-8');
      const ast = tsquery.ast(webpackConfig);
      const moduleFederationWebpackConfig = tsquery(
        ast,
        'Identifier[name=ModuleFederationPlugin]',
        {
          visitAllChildren: true,
        }
      );
      if (
        !moduleFederationWebpackConfig ||
        moduleFederationWebpackConfig.length === 0
      ) {
        return;
      }

      projects.push(projectName);
    }
  );

  return projects;
}
