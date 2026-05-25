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

/** A workspace-local plugin discovered cheaply (no JS load). */
export interface LocalPluginWithGenerators {
  /** Absolute path to the project root that hosts the plugin. */
  dir: string;
  /** The `generators` or `schematics` field value from the plugin's
   *  package.json (a relative path to the collection JSON). */
  field: string;
}

/**
 * Sync, lightweight scan: for each given project root, read its package.json
 * and yield it as a plugin if it declares a `generators`/`schematics`
 * collection. Used by tab completion which cannot afford the heavier
 * {@link getLocalWorkspacePlugins} (that one loads each plugin's JS to
 * walk its capabilities).
 *
 * `projectRoots` are paths relative to `workspaceRoot`.
 */
export function findLocalPluginsWithGenerators(
  projectRoots: Iterable<string>
): Map<string, LocalPluginWithGenerators> {
  const plugins = new Map<string, LocalPluginWithGenerators>();
  for (const root of projectRoots) {
    if (!root) continue;
    const dir = join(workspaceRoot, root);
    let pkg: PackageJson | null = null;
    try {
      pkg = readJsonFile(join(dir, 'package.json'));
    } catch {
      continue;
    }
    const field = pkg?.generators ?? pkg?.schematics;
    if (pkg?.name && typeof field === 'string') {
      plugins.set(pkg.name, { dir, field });
    }
  }
  return plugins;
}

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
