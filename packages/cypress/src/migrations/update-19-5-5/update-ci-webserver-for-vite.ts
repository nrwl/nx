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

export default async function (tree: Tree) {
  const pluginName = '@nx/cypress/plugin';
  const graph = await createProjectGraphAsync();
  const nxJson = readNxJson(tree);
  const matchingPluginRegistrations = nxJson.plugins?.filter((p) =>
    typeof p === 'string' ? p === pluginName : p.plugin === pluginName
  );

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
      const NX_TARGET_REGEX = "(?<=nx run )[^']+";
      const matches = ciWebServerCommand.match(NX_TARGET_REGEX);
      if (!matches) {
        continue;
      }
      const targetString = matches[0];
      const { project, target, configuration } = parseTargetString(
        targetString,
        graph
      );

      const pathToViteConfig = [
        joinPathFragments(graph.nodes[project].data.root, 'vite.config.ts'),
        joinPathFragments(graph.nodes[project].data.root, 'vite.config.js'),
      ].find((p) => tree.exists(p));

      if (!pathToViteConfig) {
        continue;
      }

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
          : (matchingVitePlugin.options as any)?.previewTargetName ?? 'preview'
        : 'preview';

      tree.write(
        configFile,
        `${configFileContents.slice(
          0,
          nodes[0].getStart()
        )}'nx run ${project}:${previewTargetName}',
      ciBaseUrl: "http://localhost:4300"${configFileContents.slice(
        nodes[0].getEnd()
      )}`
      );
    }
  }

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
