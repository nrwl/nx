import { existsSync } from 'fs';
import { join } from 'path';
import { NxJsonConfiguration } from '../../config/nx-json.js';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json.js';
import { readJsonFile } from '../fileutils.js';
import { PackageJson } from '../package-json.js';
import { workspaceRoot } from '../workspace-root.js';
import {
  PluginCapabilities,
  getPluginCapabilities,
} from './plugin-capabilities.js';

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
