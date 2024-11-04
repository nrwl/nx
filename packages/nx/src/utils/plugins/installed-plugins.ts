import { join } from 'path';
import { readNxJson } from '../../config/nx-json';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { readJsonFile } from '../fileutils';
import { getNxRequirePaths } from '../installation-directory';
import { PackageJson, readModulePackageJson } from '../package-json';
import { workspaceRoot } from '../workspace-root';
import {
  PluginCapabilities,
  getPluginCapabilities,
} from './plugin-capabilities';

export function findInstalledPlugins(): PackageJson[] {
  const packageJsonDeps = getDependenciesFromPackageJson();
  const nxJsonDeps = getDependenciesFromNxJson();
  const deps = packageJsonDeps.concat(nxJsonDeps);
  const result: PackageJson[] = [];
  for (const dep of deps) {
    const pluginPackageJson = getNxPluginPackageJsonOrNull(dep);
    if (pluginPackageJson) {
      result.push(pluginPackageJson);
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function getNxPluginPackageJsonOrNull(pkg: string): PackageJson | null {
  try {
    const { packageJson } = readModulePackageJson(pkg, getNxRequirePaths());
    return packageJson &&
      [
        'ng-update',
        'nx-migrations',
        'schematics',
        'generators',
        'builders',
        'executors',
      ].some((field) => field in packageJson)
      ? packageJson
      : null;
  } catch {
    return null;
  }
}

function getDependenciesFromPackageJson(
  packageJsonPath = 'package.json'
): string[] {
  try {
    const { dependencies, devDependencies } = readJsonFile(
      join(workspaceRoot, packageJsonPath)
    );
    return Object.keys({ ...dependencies, ...devDependencies });
  } catch {}
  return [];
}

function getDependenciesFromNxJson(): string[] {
  const { installation } = readNxJson();
  if (!installation) {
    return [];
  }
  return ['nx', ...Object.keys(installation.plugins || {})];
}

export async function getInstalledPluginsAndCapabilities(
  workspaceRoot: string,
  projects: Record<string, ProjectConfiguration>
): Promise<Map<string, PluginCapabilities>> {
  const plugins = findInstalledPlugins().map((p) => p.name);

  const result = new Map<string, PluginCapabilities>();
  for (const plugin of Array.from(plugins).sort()) {
    try {
      const capabilities = await getPluginCapabilities(
        workspaceRoot,
        plugin,
        projects
      );
      if (
        capabilities &&
        (capabilities.executors ||
          capabilities.generators ||
          capabilities.projectGraphExtension ||
          capabilities.projectInference)
      ) {
        result.set(plugin, capabilities);
      }
    } catch {}
  }

  return result;
}
