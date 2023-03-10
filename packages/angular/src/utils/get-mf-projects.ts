import type { Tree } from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/devkit/src/generators/executor-options-utils';

export function getMFProjects(
  tree: Tree,
  { legacy }: { legacy: boolean } = { legacy: false }
) {
  const NRWL_WEBPACK_BROWSER_BUILDER = '@nrwl/angular:webpack-browser';
  const CUSTOM_WEBPACK_OPTION = 'customWebpackConfig';
  const MODULE_FEDERATION_IDENTIFIER = legacy
    ? 'Identifier[name=ModuleFederationPlugin]'
    : 'Identifier[name=withModuleFederation]';

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
      const { tsquery } = require('@phenomnomnominal/tsquery');
      const ast = tsquery.ast(webpackConfig);
      const moduleFederationWebpackConfig = tsquery(
        ast,
        MODULE_FEDERATION_IDENTIFIER,
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
