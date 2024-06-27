import {
  readNxJson,
  updateNxJson,
  type ExpandedPluginConfiguration,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { minimatch } from 'minimatch';

export async function addPluginRegistrations<T>(
  tree: Tree,
  projectTargets: Map<string, T>,
  projects: Map<string, ProjectConfiguration>,
  pluginPath: string
): Promise<void> {
  const nxJson = readNxJson(tree);

  for (const [project, options] of projectTargets.entries()) {
    const existingPlugin = nxJson.plugins?.find(
      (plugin): plugin is ExpandedPluginConfiguration =>
        typeof plugin !== 'string' &&
        plugin.plugin === pluginPath &&
        Object.keys(options).every(
          (key) => plugin.options[key] === options[key]
        )
    );

    const projectIncludeGlob = `${projects.get(project).root}/**/*`;
    if (!existingPlugin) {
      nxJson.plugins ??= [];
      const plugin: ExpandedPluginConfiguration = {
        plugin: pluginPath,
        options,
        include: [projectIncludeGlob],
      };

      nxJson.plugins.push(plugin);
    } else if (existingPlugin.include) {
      if (
        !existingPlugin.include.some((include) =>
          minimatch(projectIncludeGlob, include, { dot: true })
        )
      ) {
        existingPlugin.include.push(projectIncludeGlob);
      }
    }
  }

  if (!areProjectsUsingTheExecutorLeft(projects)) {
    // all projects have been migrated, if there's only one plugin registration
    // left, remove its "include" property
    const pluginRegistrations = nxJson.plugins?.filter(
      (plugin): plugin is ExpandedPluginConfiguration =>
        typeof plugin !== 'string' && plugin.plugin === pluginPath
    );
    if (pluginRegistrations?.length === 1) {
      for (const plugin of pluginRegistrations) {
        delete plugin.include;
      }
    }
  }

  updateNxJson(tree, nxJson);
}

function areProjectsUsingTheExecutorLeft(
  projects: Map<string, ProjectConfiguration>
): boolean {
  return Array.from(projects.values()).some((project) =>
    Object.values(project.targets ?? {}).some(
      (target) => target.executor === '@nx/rollup:rollup'
    )
  );
}
