import {
  type Tree,
  CreateNodesV2,
  createProjectGraphAsync,
  readNxJson,
  parseTargetString,
  joinPathFragments,
  PluginConfiguration,
  CreateNodes,
  formatFiles,
  type ProjectGraph,
} from '@nx/devkit';
import {
  retrieveProjectConfigurations,
  LoadedNxPlugin,
  ProjectConfigurationsError,
  findMatchingConfigFiles,
} from 'nx/src/devkit-internals';
import { ConfigurationResult } from 'nx/src/project-graph/utils/project-configuration-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { CypressPluginOptions } from '../../plugins/plugin';
import addE2ECiTargetDefaults from './add-e2e-ci-target-defaults';

export default async function (tree: Tree) {
  const pluginName = '@nx/cypress/plugin';
  const graph = await createProjectGraphAsync();
  const nxJson = readNxJson(tree);
  const matchingPluginRegistrations = nxJson.plugins?.filter((p) =>
    typeof p === 'string' ? p === pluginName : p.plugin === pluginName
  );

  if (!matchingPluginRegistrations?.length) {
    return;
  }

  const {
    createNodesV2,
  }: { createNodesV2: CreateNodesV2<CypressPluginOptions> } = await import(
    pluginName
  );

  for (const plugin of matchingPluginRegistrations) {
    let projectConfigs: ConfigurationResult;
    try {
      const loadedPlugin = new LoadedNxPlugin(
        { createNodesV2, name: pluginName },
        plugin
      );
      projectConfigs = await retrieveProjectConfigurations(
        [loadedPlugin],
        tree.root,
        nxJson
      );
    } catch (e) {
      if (e instanceof ProjectConfigurationsError) {
        projectConfigs = e.partialProjectConfigurationsResult;
      } else {
        throw e;
      }
    }

    for (const configFile of projectConfigs.matchingProjectFiles) {
      const configFileContents = tree.read(configFile, 'utf-8');
      if (!configFileContents.includes('ciWebServerCommand')) {
        continue;
      }

      const ast = tsquery.ast(configFileContents);
      const CI_WEBSERVER_COMMAND_SELECTOR =
        'ObjectLiteralExpression PropertyAssignment:has(Identifier[name=ciWebServerCommand]) > StringLiteral';
      const nodes = tsquery(ast, CI_WEBSERVER_COMMAND_SELECTOR, {
        visitAllChildren: true,
      });
      if (!nodes.length) {
        continue;
      }
      const ciWebServerCommand = nodes[0].getText();
      let project: string;
      let portFlagValue: string | undefined;
      if (ciWebServerCommand.includes('nx run')) {
        const NX_TARGET_REGEX =
          /(?<=nx run )([^' ]+)(?: [^']*--port[= ](\d+))?/;
        const matches = ciWebServerCommand.match(NX_TARGET_REGEX);
        if (!matches) {
          continue;
        }
        const targetString = matches[1];
        project = parseTargetString(targetString, graph).project;
        portFlagValue = matches[2];
      } else {
        const NX_PROJECT_REGEX =
          /(?<=nx [^ ]+ )([^' ]+)(?: [^']*--port[= ](\d+))?/;
        const matches = ciWebServerCommand.match(NX_PROJECT_REGEX);
        if (!matches) {
          continue;
        }
        project = matches[1];
        portFlagValue = matches[2];
      }

      if (!project || !graph.nodes[project]) {
        continue;
      }

      const pathToViteConfig = [
        joinPathFragments(graph.nodes[project].data.root, 'vite.config.ts'),
        joinPathFragments(graph.nodes[project].data.root, 'vite.config.js'),
      ].find((p) => tree.exists(p));

      const pathToWebpackConfig = [
        joinPathFragments(graph.nodes[project].data.root, 'webpack.config.ts'),
        joinPathFragments(graph.nodes[project].data.root, 'webpack.config.js'),
      ].find((p) => tree.exists(p));

      if (!pathToViteConfig && !pathToWebpackConfig) {
        continue;
      }

      if (pathToWebpackConfig) {
        const matchingWebpackPlugin = await findPluginForConfigFile(
          tree,
          '@nx/webpack/plugin',
          pathToWebpackConfig
        );
        const serveStaticTargetName = matchingWebpackPlugin
          ? typeof matchingWebpackPlugin === 'string'
            ? 'serve-static'
            : (matchingWebpackPlugin.options as any)?.serveStaticTargetName ??
              'serve-static'
          : getServeStaticLikeTarget(
              tree,
              graph,
              project,
              '@nx/web:file-server'
            ) ?? undefined;

        if (!serveStaticTargetName) {
          continue;
        }

        const newCommand = ciWebServerCommand.replace(
          /nx.*[^"']/,
          `nx run ${project}:${serveStaticTargetName}${
            portFlagValue ? ` --port=${portFlagValue}` : ''
          }`
        );
        tree.write(
          configFile,
          `${configFileContents.slice(
            0,
            nodes[0].getStart()
          )}${newCommand}${configFileContents.slice(nodes[0].getEnd())}`
        );
      } else if (pathToViteConfig) {
        const viteConfigContents = tree.read(pathToViteConfig, 'utf-8');
        if (!viteConfigContents.includes('preview:')) {
          continue;
        }

        const matchingVitePlugin = await findPluginForConfigFile(
          tree,
          '@nx/vite/plugin',
          pathToViteConfig
        );
        const previewTargetName = matchingVitePlugin
          ? typeof matchingVitePlugin === 'string'
            ? 'preview'
            : (matchingVitePlugin.options as any)?.previewTargetName ??
              'preview'
          : getServeStaticLikeTarget(
              tree,
              graph,
              project,
              '@nx/vite:preview-server'
            ) ?? undefined;

        if (!previewTargetName) {
          continue;
        }

        const newCommand = ciWebServerCommand.replace(
          /nx.*[^"']/,
          `nx run ${project}:${previewTargetName}${
            portFlagValue ? ` --port=${portFlagValue}` : ''
          }`
        );
        tree.write(
          configFile,
          `${configFileContents.slice(0, nodes[0].getStart())}${newCommand},
      ciBaseUrl: "http://localhost:${
        portFlagValue ?? '4300'
      }"${configFileContents.slice(nodes[0].getEnd())}`
        );
      }
    }
  }

  await addE2ECiTargetDefaults(tree);

  await formatFiles(tree);
}

async function findPluginForConfigFile(
  tree: Tree,
  pluginName: string,
  pathToConfigFile: string
): Promise<PluginConfiguration> {
  const nxJson = readNxJson(tree);
  if (!nxJson.plugins) {
    return;
  }

  const pluginRegistrations: PluginConfiguration[] = nxJson.plugins.filter(
    (p) => (typeof p === 'string' ? p === pluginName : p.plugin === pluginName)
  );

  for (const plugin of pluginRegistrations) {
    if (typeof plugin === 'string') {
      return plugin;
    }

    if (!plugin.include && !plugin.exclude) {
      return plugin;
    }

    if (plugin.include || plugin.exclude) {
      const resolvedPlugin: {
        createNodes?: CreateNodes;
        createNodesV2?: CreateNodesV2;
      } = await import(pluginName);
      const pluginGlob =
        resolvedPlugin.createNodesV2?.[0] ?? resolvedPlugin.createNodes?.[0];
      const matchingConfigFile = findMatchingConfigFiles(
        [pathToConfigFile],
        pluginGlob,
        plugin.include,
        plugin.exclude
      );
      if (matchingConfigFile.length) {
        return plugin;
      }
    }
  }
}

function getServeStaticLikeTarget(
  tree: Tree,
  graph: ProjectGraph,
  projectName: string,
  executorName: string
) {
  if (!graph.nodes[projectName]?.data?.targets) {
    return;
  }

  for (const [targetName, targetOptions] of Object.entries(
    graph.nodes[projectName].data.targets
  )) {
    if (targetOptions.executor && targetOptions.executor === executorName) {
      return targetName;
    }
  }
}
