import {
  ProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { logger, formatFiles, getProjects } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { Node } from 'typescript';

export default async function (tree: Tree) {
  const NRWL_WEBPACK_BROWSER_BUILDER = '@nrwl/angular:webpack-browser';
  const CUSTOM_WEBPACK_OPTION = 'customWebpackConfig';

  const projects = getProjects(tree);

  const projectsToUpdateServeTarget = new Map<string, ProjectConfiguration>();
  forEachExecutorOptions(
    tree,
    NRWL_WEBPACK_BROWSER_BUILDER,
    (opts, projectName) => {
      // Update the webpack config
      const webpackPath = opts[CUSTOM_WEBPACK_OPTION].path;
      if (!tree.exists(webpackPath)) {
        logger.warn(
          `Webpack config file for project: ${projectName} does not exist. Skipping project.`
        );
        return;
      }
      const webpackConfig = tree.read(webpackPath, 'utf-8');
      if (!webpackConfig.includes('ModuleFederationPlugin')) {
        logger.warn(
          `Webpack config file for project: ${projectName} is not using Module Federation. Skipping project.`
        );
        return;
      }

      const updatedWebpackFile = updateScriptType(webpackConfig);
      tree.write(webpackPath, updatedWebpackFile);

      // migrate the serve-mfe target to use liveReload=false
      const project = projects.get(projectName);
      if ('serve-mfe' in project.targets) {
        projectsToUpdateServeTarget.set(projectName, project);
      }
    }
  );

  for (const [projectName, project] of projectsToUpdateServeTarget) {
    const updatedCommands = project.targets['serve-mfe'].options.commands.map(
      (command: string) => `${command} --liveReload=false`
    );
    let updatedProject = project;
    updatedProject.targets['serve-mfe'].options.commands = updatedCommands;
    updateProjectConfiguration(tree, projectName, updatedProject);
  }

  await formatFiles(tree);
}

export function updateScriptType(webpackConfig: string) {
  const WEBPACK_OUTPUT_OBJECT_QUERY =
    'PropertyAssignment > Identifier[name=output] ~ ObjectLiteralExpression';

  const ast = tsquery.ast(webpackConfig);
  const outputObjectNode = tsquery(ast, WEBPACK_OUTPUT_OBJECT_QUERY, {
    visitAllChildren: true,
  })[0] as Node;

  if (!outputObjectNode) {
    return webpackConfig;
  }

  if (outputObjectNode.getText().includes('text/javascript')) {
    return webpackConfig;
  }

  const WEBPACK_OUTPUT_PROPS_QUERY =
    'Identifier[name=output] ~ ObjectLiteralExpression > PropertyAssignment:last-child';
  const outputPropertyNode = tsquery(ast, WEBPACK_OUTPUT_PROPS_QUERY, {
    visitAllChildren: true,
  })[0] as Node;

  const outputPropertyEndIndex = outputPropertyNode.end;

  return `${webpackConfig.slice(
    0,
    outputPropertyEndIndex
  )},\nscriptType: 'text/javascript'${webpackConfig.slice(
    outputPropertyEndIndex
  )}`;
}
