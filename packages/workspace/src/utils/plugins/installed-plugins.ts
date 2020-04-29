import { terminal } from '@angular-devkit/core';
import { readdirSync } from 'fs';
import * as path from 'path';
import { output } from '../output';
import { CommunityPlugin, CorePlugin, PluginCapabilities } from './models';
import { getPluginCapabilities } from './plugin-capabilities';
import { hasElements } from './shared';

function getPackagesFromNodeModules(
  workspaceRoot: string,
  requery: boolean = false
): string[] {
  let packageList: string[] = [];

  if (!requery && packageList.length > 0) {
    return packageList;
  }

  const nodeModulesDir = path.join(workspaceRoot, 'node_modules');
  readdirSync(nodeModulesDir).forEach((npmPackageOrScope) => {
    if (npmPackageOrScope.startsWith('@')) {
      readdirSync(path.join(nodeModulesDir, npmPackageOrScope)).forEach((p) => {
        packageList.push(`${npmPackageOrScope}/${p}`);
      });
    } else {
      packageList.push(npmPackageOrScope);
    }
  });

  return packageList;
}

export function getInstalledPluginsFromNodeModules(
  workspaceRoot: string,
  corePlugins: CorePlugin[],
  communityPlugins: CommunityPlugin[]
): Array<PluginCapabilities> {
  const corePluginNames = corePlugins.map((p) => p.name);
  const communityPluginNames = communityPlugins.map((p) => p.name);
  const packages = getPackagesFromNodeModules(workspaceRoot);

  return packages
    .filter(
      (name) =>
        corePluginNames.indexOf(name) > -1 ||
        communityPluginNames.indexOf(name) > -1
    )
    .map((name) => getPluginCapabilities(workspaceRoot, name))
    .filter((x) => x && !!(x.schematics || x.builders));
}

export function listInstalledPlugins(installedPlugins: PluginCapabilities[]) {
  output.log({
    title: `Installed plugins:`,
    bodyLines: installedPlugins.map((p) => {
      const capabilities = [];
      if (hasElements(p.builders)) {
        capabilities.push('builders');
      }
      if (hasElements(p.schematics)) {
        capabilities.push('schematics');
      }
      return `${terminal.bold(p.name)} (${capabilities.join()})`;
    }),
  });
}
