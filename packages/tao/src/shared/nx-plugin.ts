import { sync } from 'fast-glob';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { appRootPath } from '../utils/app-root';
import { readJsonFile } from '../utils/fileutils';
import { ProjectGraphProcessor } from './project-graph';
import { TargetConfiguration } from './workspace';

export type ProjectTargetConfigurator = (
  file: string
) => Record<string, TargetConfiguration>;

/**
 * A plugin for Nx
 */
export interface NxPlugin {
  name: string;
  processProjectGraph?: ProjectGraphProcessor;
  registerProjectTargets?: ProjectTargetConfigurator;

  /**
   * A glob pattern to search for non-standard project files.
   * @example: ["*.csproj", "pom.xml"]
   */
  projectFilePatterns?: string[];
}

function findPluginPackageJson(path: string, plugin: string) {
  while (true) {
    if (!path.startsWith(appRootPath)) {
      throw new Error("Couldn't find a package.json for Nx plugin:" + plugin);
    }
    if (existsSync(join(path, 'package.json'))) {
      return join(path, 'package.json');
    }
    path = dirname(path);
  }
}

let nxPluginCache: NxPlugin[] = null;
export function loadNxPlugins(plugins?: string[]): NxPlugin[] {
  return plugins?.length
    ? nxPluginCache ||
        (nxPluginCache = plugins.map((path) => {
          const pluginPath = require.resolve(path, {
            paths: [appRootPath],
          });

          const { name } = readJsonFile(
            findPluginPackageJson(pluginPath, path)
          );
          const plugin = require(pluginPath) as NxPlugin;
          plugin.name = name;

          return plugin;
        }))
    : [];
}

export function mergePluginTargetsWithNxTargets(
  projectRoot: string,
  targets: Record<string, TargetConfiguration>,
  plugins: NxPlugin[]
): Record<string, TargetConfiguration> {
  let newTargets: Record<string, TargetConfiguration> = {};
  for (const plugin of plugins) {
    if (!plugin.projectFilePatterns?.length || !plugin.registerProjectTargets) {
      continue;
    }

    const projectFiles = sync(`+(${plugin.projectFilePatterns.join('|')})`, {
      cwd: join(appRootPath, projectRoot),
    });
    for (const projectFile of projectFiles) {
      newTargets = {
        ...newTargets,
        ...plugin.registerProjectTargets(join(projectRoot, projectFile)),
      };
    }
  }
  return { ...newTargets, ...targets };
}
