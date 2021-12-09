import type { Tree } from '@nrwl/devkit';
import {
  logger,
  formatFiles,
  updateProjectConfiguration,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { Identifier, Node, StringLiteral } from 'typescript';

export default async function (tree: Tree) {
  const NRWL_WEBPACK_BROWSER_BUILDER = '@nrwl/angular:webpack-browser';
  const CUSTOM_WEBPACK_OPTION = 'customWebpackConfig';

  const projects = [];
  forEachExecutorOptions(
    tree,
    NRWL_WEBPACK_BROWSER_BUILDER,
    (opts, projectName) => {
      // Update the webpack config
      const webpackPath = opts[CUSTOM_WEBPACK_OPTION]?.path;
      if (!tree.exists(webpackPath)) {
        logger.warn(
          `Webpack config file for project: ${projectName} does not exist. Skipping project.`
        );
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

      let updatedWebpackFile = addExperimentsObject(webpackConfig);
      updatedWebpackFile = addLibraryModuleType(updatedWebpackFile);
      updatedWebpackFile = removeRemoteName(updatedWebpackFile);
      tree.write(webpackPath, updatedWebpackFile);
    }
  );
  addPublicHost(tree, projects);

  await formatFiles(tree);
}

export function addExperimentsObject(webpackConfig: string) {
  const WEBPACK_EXPERIMENTS_QUERY =
    'PropertyAssignment > Identifier[name=experiments] ~ ObjectLiteralExpression';
  const ast = tsquery.ast(webpackConfig);
  const webpackExperimentsNode = tsquery(ast, WEBPACK_EXPERIMENTS_QUERY, {
    visitAllChildren: true,
  });

  if (webpackExperimentsNode && webpackExperimentsNode.length > 0) {
    if (webpackExperimentsNode[0].getText().includes('outputModule')) {
      return webpackConfig;
    }

    return `${webpackConfig.slice(
      0,
      webpackExperimentsNode[0].getStart() + 1
    )}\noutputModule: true,${webpackConfig.slice(
      webpackExperimentsNode[0].getStart() + 1
    )}`;
  }

  const WEBPACK_EXPORT = 'module.exports = {';
  const openingBracePos =
    webpackConfig.indexOf(WEBPACK_EXPORT) + WEBPACK_EXPORT.length;

  return `${webpackConfig.slice(0, openingBracePos)}
  experiments: {
    outputModule: true  
  },${webpackConfig.slice(openingBracePos)}`;
}

export function addLibraryModuleType(webpackConfig: string) {
  const LIBRARY_NODE_QUERY =
    'PropertyAssignment > Identifier[name=library] ~ ObjectLiteralExpression';
  const ast = tsquery.ast(webpackConfig);
  const libraryModuleNode = tsquery(ast, LIBRARY_NODE_QUERY);

  if (libraryModuleNode && libraryModuleNode.length > 0) {
    return webpackConfig;
  }

  const MODULE_FEDERATION_PLUGIN_INSTANTIATION = 'new ModuleFederationPlugin({';
  const openingBracePos =
    webpackConfig.indexOf(MODULE_FEDERATION_PLUGIN_INSTANTIATION) +
    +MODULE_FEDERATION_PLUGIN_INSTANTIATION.length;
  return `${webpackConfig.slice(0, openingBracePos)}
  library: {
      type: 'module'
  },${webpackConfig.slice(openingBracePos)}`;
}

export function removeRemoteName(webpackConfig: string) {
  const REMOTES_QUERY = 'Identifier[name=remotes] ~ ObjectLiteralExpression';

  const ast = tsquery.ast(webpackConfig);
  const remotesObjectNode = tsquery(ast, REMOTES_QUERY, {
    visitAllChildren: true,
  })[0] as Node;

  if (!remotesObjectNode) {
    return webpackConfig;
  }

  const remoteProps = tsquery(remotesObjectNode, 'PropertyAssignment', {
    visitAllChildren: true,
  });

  const updatedRemoteProps: string[] = [];
  for (const prop of remoteProps) {
    const stringValue = tsquery(prop, 'StringLiteral', {
      visitAllChildren: true,
    })[0] as StringLiteral;

    if (!stringValue.getText().match(/\w*@*http/)) {
      continue;
    }

    const identifier = tsquery(prop, 'Identifier', {
      visitAllChildren: true,
    })[0] as Identifier;

    const updatedRemoteStringValue = stringValue
      .getText()
      .slice(stringValue.getText().indexOf('@') + 1, -1);

    updatedRemoteProps.push(
      `${identifier.getText()}: '${updatedRemoteStringValue}'`
    );
  }

  const updatedRemotesObject = `{
    ${updatedRemoteProps.join(',\n')}
  }`;

  return `${webpackConfig.slice(
    0,
    remotesObjectNode.getStart()
  )}${updatedRemotesObject}${webpackConfig.slice(remotesObjectNode.getEnd())}`;
}

export function addPublicHost(tree: Tree, projects: string[]) {
  for (const projectName of projects) {
    const project = readProjectConfiguration(tree, projectName);
    const updatedProject = {
      ...project,
      targets: {
        ...project.targets,
        serve: {
          ...project.targets.serve,
          options: {
            ...project.targets.serve.options,
            publicHost: `http://localhost:${
              project.targets.serve.options?.port ?? 4200
            }`,
          },
        },
      },
    };
    updateProjectConfiguration(tree, projectName, updatedProject);
  }
}
