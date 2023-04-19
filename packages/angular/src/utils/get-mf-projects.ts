import type { Tree } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

function _getMfProjects(
  tree: Tree,
  CUSTOM_WEBPACK_OPTION: string,
  MODULE_FEDERATION_IDENTIFIER: string,
  projects: string[]
) {
  return (opts, projectName) => {
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
  };
}

export function getMFProjects(
  tree: Tree,
  { legacy }: { legacy: boolean } = { legacy: false }
) {
  const CUSTOM_WEBPACK_OPTION = 'customWebpackConfig';
  const MODULE_FEDERATION_IDENTIFIER = legacy
    ? 'Identifier[name=ModuleFederationPlugin]'
    : 'Identifier[name=withModuleFederation]';

  const projects: string[] = [];
  forEachExecutorOptions(
    tree,
    '@nx/angular:webpack-browser',
    _getMfProjects(
      tree,
      CUSTOM_WEBPACK_OPTION,
      MODULE_FEDERATION_IDENTIFIER,
      projects
    )
  );
  forEachExecutorOptions(
    tree,
    '@nrwl/angular:webpack-browser',
    _getMfProjects(
      tree,
      CUSTOM_WEBPACK_OPTION,
      MODULE_FEDERATION_IDENTIFIER,
      projects
    )
  );

  return projects;
}
