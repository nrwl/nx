import * as chalk from 'chalk';
import { output } from '../output';
import type { CommunityPlugin, CorePlugin, PluginCapabilities } from './models';
import { getPluginCapabilities } from './plugin-capabilities';
import { hasElements } from './shared';
import { readJsonFile } from '../fileutils';
import { PackageJson, readModulePackageJson } from '../package-json';
import { ProjectsConfigurations } from 'nx/src/config/workspace-json-project-json';
import { join } from 'path';
import { workspaceRoot } from '../workspace-root';
import { existsSync } from 'fs';
import { ExecutorsJson, GeneratorsJson } from 'nx/src/config/misc-interfaces';

export function getLocalWorkspacePlugins(
  projectsConfiguration: ProjectsConfigurations
): Map<string, PluginCapabilities> {
  const plugins: Map<string, PluginCapabilities> = new Map();
  for (const project of Object.values(projectsConfiguration.projects)) {
    const packageJsonPath = join(workspaceRoot, project.root, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson: PackageJson = readJsonFile(packageJsonPath);
      const capabilities: Partial<PluginCapabilities> = {};
      const generatorsPath = packageJson.generators ?? packageJson.schematics;
      const executorsPath = packageJson.executors ?? packageJson.builders;
      if (generatorsPath) {
        const file = readJsonFile<GeneratorsJson>(
          join(workspaceRoot, project.root, generatorsPath)
        );
        capabilities.generators = file.generators ?? file.schematics;
      }
      if (executorsPath) {
        const file = readJsonFile<ExecutorsJson>(
          join(workspaceRoot, project.root, executorsPath)
        );
        capabilities.executors = file.executors ?? file.builders;
      }
      if (capabilities.executors || capabilities.generators) {
        plugins.set(packageJson.name, {
          executors: capabilities.executors ?? {},
          generators: capabilities.generators ?? {},
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
    bodyLines.push(`${chalk.bold(p.name)} (${capabilities.join()})`);
  }

  output.log({
    title: `Local workspace plugins:`,
    bodyLines: bodyLines,
  });
}
