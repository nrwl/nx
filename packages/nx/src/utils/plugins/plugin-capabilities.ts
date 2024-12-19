import { dirname, join } from 'path';
import {
  ExecutorsJsonEntry,
  GeneratorsJsonEntry,
} from '../../config/misc-interfaces';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { readJsonFile } from '../fileutils';
import { getNxRequirePaths } from '../installation-directory';
import { readPluginPackageJson } from '../../project-graph/plugins';
import { loadNxPlugin } from '../../project-graph/plugins/loader';
import { PackageJson } from '../package-json';
import { LoadedNxPlugin } from '../../project-graph/plugins/internal-api';

export interface PluginCapabilities {
  name: string;
  executors?: { [name: string]: ExecutorsJsonEntry };
  generators?: { [name: string]: GeneratorsJsonEntry };
  projectInference?: boolean;
  projectGraphExtension?: boolean;
}

function tryGetCollection<T extends object>(
  packageJsonPath: string,
  collectionFile: string | undefined,
  propName: string
): T | null {
  if (!collectionFile) {
    return null;
  }

  try {
    const collectionFilePath = join(dirname(packageJsonPath), collectionFile);
    return readJsonFile<T>(collectionFilePath)[propName];
  } catch {
    return null;
  }
}

export async function getPluginCapabilities(
  workspaceRoot: string,
  pluginName: string,
  projects: Record<string, ProjectConfiguration>,
  includeRuntimeCapabilities = false
): Promise<PluginCapabilities | null> {
  try {
    const { json: packageJson, path: packageJsonPath } = readPluginPackageJson(
      pluginName,
      projects,
      getNxRequirePaths(workspaceRoot)
    );
    const pluginModule = includeRuntimeCapabilities
      ? await tryGetModule(packageJson, workspaceRoot)
      : ({} as Record<string, unknown>);
    return {
      name: pluginName,
      generators: {
        ...tryGetCollection(
          packageJsonPath,
          packageJson.schematics,
          'schematics'
        ),
        ...tryGetCollection(
          packageJsonPath,
          packageJson.generators,
          'schematics'
        ),
        ...tryGetCollection(
          packageJsonPath,
          packageJson.schematics,
          'generators'
        ),
        ...tryGetCollection(
          packageJsonPath,
          packageJson.generators,
          'generators'
        ),
      },
      executors: {
        ...tryGetCollection(packageJsonPath, packageJson.builders, 'builders'),
        ...tryGetCollection(packageJsonPath, packageJson.executors, 'builders'),
        ...tryGetCollection(packageJsonPath, packageJson.builders, 'executors'),
        ...tryGetCollection(
          packageJsonPath,
          packageJson.executors,
          'executors'
        ),
      },
      projectGraphExtension:
        pluginModule &&
        ('processProjectGraph' in pluginModule ||
          'createNodes' in pluginModule ||
          'createNodesV2' in pluginModule ||
          'createMetadata' in pluginModule ||
          'createDependencies' in pluginModule),
      projectInference:
        pluginModule &&
        ('projectFilePatterns' in pluginModule ||
          'createNodes' in pluginModule ||
          'createNodesV2' in pluginModule),
    };
  } catch {
    return null;
  }
}

async function tryGetModule(
  packageJson: PackageJson,
  workspaceRoot: string
): Promise<LoadedNxPlugin | null> {
  try {
    if (
      packageJson.generators ??
      packageJson.executors ??
      packageJson['nx-migrations'] ??
      packageJson['schematics'] ??
      packageJson['builders']
    ) {
      const [pluginPromise] = loadNxPlugin(packageJson.name, workspaceRoot);
      return await pluginPromise;
    } else {
      return {
        name: packageJson.name,
      };
    }
  } catch {
    return null;
  }
}
