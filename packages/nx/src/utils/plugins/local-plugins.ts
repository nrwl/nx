import { existsSync } from 'fs';
import { join } from 'path';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';
import { readJsonFile } from '../fileutils';
import { PackageJson } from '../package-json';
import { workspaceRoot } from '../workspace-root';
import {
  PluginCapabilities,
  getPluginCapabilities,
} from './plugin-capabilities';

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
