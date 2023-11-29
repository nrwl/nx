import * as chalk from 'chalk';
import { output } from '../output';
import type { PluginCapabilities } from './models';
import { hasElements } from './shared';
import { readJsonFile } from '../fileutils';
import { PackageJson } from '../package-json';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';
import { join } from 'path';
import { workspaceRoot } from '../workspace-root';
import { existsSync } from 'fs';
import { getPluginCapabilities } from './plugin-capabilities';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';

export async function getLocalWorkspacePlugins(
  projectsConfiguration: ProjectsConfigurations,
  nxJson: NxJsonConfiguration
): Promise<Map<string, PluginCapabilities>> {
  const plugins: Map<string, PluginCapabilities> = new Map();
  for (const project of Object.values(projectsConfiguration.projects)) {
    const packageJsonPath = join(workspaceRoot, project.root, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson: PackageJson = readJsonFile(packageJsonPath);
      const includeRuntimeCapabilities = nxJson?.plugins?.some((p) =>
        (typeof p === 'string' ? p : p.plugin).startsWith(packageJson.name)
      );
      const capabilities = await getPluginCapabilities(
        workspaceRoot,
        packageJson.name,
        projectsConfiguration.projects,
        includeRuntimeCapabilities
      );
      if (
        capabilities &&
        (Object.keys(capabilities.executors ?? {}).length ||
          Object.keys(capabilities.generators ?? {}).length ||
          capabilities.projectGraphExtension ||
          capabilities.projectInference)
      ) {
        plugins.set(packageJson.name, {
          ...capabilities,
          name: packageJson.name,
        });
      }
    }
  }
  return plugins;
}

export function listLocalWorkspacePlugins(
  installedPlugins: Map<string, PluginCapabilities>
) {
  const bodyLines: string[] = [];

  for (const [, p] of installedPlugins) {
    const capabilities = [];
    if (hasElements(p.executors)) {
      capabilities.push('executors');
    }
    if (hasElements(p.generators)) {
      capabilities.push('generators');
    }
    if (p.projectGraphExtension) {
      capabilities.push('graph-extension');
    }
    if (p.projectInference) {
      capabilities.push('project-inference');
    }
    bodyLines.push(`${chalk.bold(p.name)} (${capabilities.join()})`);
  }

  output.log({
    title: `Local workspace plugins:`,
    bodyLines: bodyLines,
  });
}
