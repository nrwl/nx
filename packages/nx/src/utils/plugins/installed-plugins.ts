import * as chalk from 'chalk';
import { output } from '../output';
import type { PluginCapabilities } from './models';
import { getPluginCapabilities } from './plugin-capabilities';
import { hasElements } from './shared';
import { readJsonFile } from '../fileutils';
import { PackageJson, readModulePackageJson } from '../package-json';
import { workspaceRoot } from '../workspace-root';
import { join } from 'path';
import { NxJsonConfiguration } from '../../config/nx-json';
import { getNxRequirePaths } from '../installation-directory';

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
  const { installation } = readJsonFile<NxJsonConfiguration>(
    join(workspaceRoot, 'nx.json')
  );
  if (!installation) {
    return [];
  }
  return ['nx', ...Object.keys(installation.plugins || {})];
}

export async function getInstalledPluginsAndCapabilities(
  workspaceRoot: string
): Promise<Map<string, PluginCapabilities>> {
  const plugins = findInstalledPlugins().map((p) => p.name);

  const result = new Map<string, PluginCapabilities>();
  for (const plugin of Array.from(plugins).sort()) {
    try {
      const capabilities = await getPluginCapabilities(workspaceRoot, plugin);
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

export function listInstalledPlugins(
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
      capabilities.push('graph-extensions');
    }
    if (p.projectInference) {
      capabilities.push('project-inference');
    }
    bodyLines.push(`${chalk.bold(p.name)} (${capabilities.join()})`);
  }

  output.log({
    title: `Installed plugins:`,
    bodyLines: bodyLines,
  });
}
