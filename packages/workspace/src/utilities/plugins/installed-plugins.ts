import * as chalk from 'chalk';
import { readJsonFile } from '@nrwl/devkit';
import { output } from '../output';
import type { CommunityPlugin, CorePlugin, PluginCapabilities } from './models';
import { getPluginCapabilities } from './plugin-capabilities';
import { hasElements } from './shared';
import { readModulePackageJson } from 'nx/src/utils/package-json';

export function getInstalledPluginsFromPackageJson(
  workspaceRoot: string,
  corePlugins: CorePlugin[],
  communityPlugins: CommunityPlugin[] = []
): Map<string, PluginCapabilities> {
  const packageJson = readJsonFile(`${workspaceRoot}/package.json`);

  const plugins = new Set([
    ...corePlugins.map((p) => p.name),
    ...communityPlugins.map((p) => p.name),
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
  ]);

  return new Map(
    Array.from(plugins)
      .filter((name) => {
        try {
          // Check for `package.json` existence instead of requiring the module itself
          // because malformed entries like `main`, may throw false exceptions.
          readModulePackageJson(name);
          return true;
        } catch {
          return false;
        }
      })
      .sort()
      .map<[string, PluginCapabilities]>((name) => [
        name,
        getPluginCapabilities(workspaceRoot, name),
      ])
      .filter(([, x]) => x && !!(x.generators || x.executors))
  );
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
    bodyLines.push(`${chalk.bold(p.name)} (${capabilities.join()})`);
  }

  output.log({
    title: `Installed plugins:`,
    bodyLines: bodyLines,
  });
}
