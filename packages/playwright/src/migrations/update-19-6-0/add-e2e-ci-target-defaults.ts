import {
  type Tree,
  type CreateNodesV2,
  formatFiles,
  readNxJson,
  createProjectGraphAsync,
  parseTargetString,
} from '@nx/devkit';
import { addE2eCiTargetDefaults as _addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { LoadedNxPlugin } from 'nx/src/project-graph/plugins/internal-api';
import type { ConfigurationResult } from 'nx/src/project-graph/utils/project-configuration-utils';
import {
  ProjectConfigurationsError,
  retrieveProjectConfigurations,
} from 'nx/src/devkit-internals';
import { tsquery } from '@phenomnomnominal/tsquery';
import { type PlaywrightPluginOptions } from '../../plugins/plugin';

export default async function addE2eCiTargetDefaults(tree: Tree) {
  const pluginName = '@nx/playwright/plugin';
  const graph = await createProjectGraphAsync();
  const nxJson = readNxJson(tree);
  const matchingPluginRegistrations = nxJson.plugins?.filter((p) =>
    typeof p === 'string' ? p === pluginName : p.plugin === pluginName
  );

  if (!matchingPluginRegistrations) {
    return;
  }

  const {
    createNodesV2,
  }: { createNodesV2: CreateNodesV2<PlaywrightPluginOptions> } = await import(
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

      const ast = tsquery.ast(configFileContents);
      const CI_WEBSERVER_COMMAND_SELECTOR =
        'PropertyAssignment:has(Identifier[name=webServer]) PropertyAssignment:has(Identifier[name=command]) > StringLiteral';
      const nodes = tsquery(ast, CI_WEBSERVER_COMMAND_SELECTOR, {
        visitAllChildren: true,
      });
      if (!nodes.length) {
        continue;
      }
      const ciWebServerCommand = nodes[0].getText();
      let serveStaticProject: string;
      let serveStaticTarget: string;
      let serveStaticConfiguration: string;
      if (ciWebServerCommand.includes('nx run')) {
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
        serveStaticProject = project;
        serveStaticTarget = target;
        serveStaticConfiguration = configuration;
      } else {
        const NX_PROJECT_REGEX = 'nx\\s+([^ ]+)\\s+([^ ]+)';
        const matches = ciWebServerCommand.match(NX_PROJECT_REGEX);
        if (!matches) {
          return;
        }
        serveStaticTarget = matches[1];
        serveStaticProject = matches[2];
      }

      const resolvedServeStaticTarget =
        graph.nodes[serveStaticProject].data.targets[serveStaticTarget];

      let resolvedBuildTarget: string;
      if (resolvedServeStaticTarget.dependsOn) {
        resolvedBuildTarget = resolvedServeStaticTarget.dependsOn.join(',');
      } else {
        resolvedBuildTarget =
          (serveStaticConfiguration
            ? resolvedServeStaticTarget.configurations[serveStaticConfiguration]
                .buildTarget
            : resolvedServeStaticTarget.options.buildTarget) ?? 'build';
      }

      const buildTarget = `^${resolvedBuildTarget}`;

      await _addE2eCiTargetDefaults(tree, pluginName, buildTarget, configFile);
    }
  }
}
