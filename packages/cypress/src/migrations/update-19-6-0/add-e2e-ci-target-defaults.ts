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
import { type CypressPluginOptions } from '../../plugins/plugin';
import { dirname } from 'path';

export default async function addE2eCiTargetDefaults(tree: Tree) {
  const pluginName = '@nx/cypress/plugin';
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

      const targetDependsOnSelf =
        graph.nodes[project].data.root === dirname(configFile);

      const serveStaticTarget = graph.nodes[project].data.targets[target];
      if (!serveStaticTarget) {
        continue;
      }
      let resolvedBuildTarget: string;
      if (serveStaticTarget?.dependsOn) {
        resolvedBuildTarget = serveStaticTarget.dependsOn.join(',');
      } else {
        resolvedBuildTarget =
          (configuration
            ? serveStaticTarget.configurations[configuration].buildTarget
            : serveStaticTarget.options.buildTarget) ?? 'build';
      }

      const buildTarget = `${
        targetDependsOnSelf ? '' : '^'
      }${resolvedBuildTarget}`;

      await _addE2eCiTargetDefaults(tree, pluginName, buildTarget, configFile);
    }
  }

  await formatFiles(tree);
}
