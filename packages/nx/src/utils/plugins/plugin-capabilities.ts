import { workspaceRoot } from '../workspace-root';
import * as chalk from 'chalk';
import { dirname, join } from 'path';
import { output } from '../output';
import type { PluginCapabilities } from './models';
import { hasElements } from './shared';
import { readJsonFile } from '../fileutils';
import { getPackageManagerCommand } from '../package-manager';
import {
  loadNxPluginAsync,
  NxPlugin,
  readPluginPackageJson,
} from '../nx-plugin';
import { getNxRequirePaths } from '../installation-directory';
import { PackageJson } from '../package-json';

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
  pluginName: string
): Promise<PluginCapabilities | null> {
  try {
    const { json: packageJson, path: packageJsonPath } = readPluginPackageJson(
      pluginName,
      getNxRequirePaths(workspaceRoot)
    );
    const pluginModule = await tryGetModule(packageJson, workspaceRoot);
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
      projectGraphExtension: !!pluginModule?.processProjectGraph,
      projectInference: !!pluginModule?.projectFilePatterns,
    };
  } catch {
    return null;
  }
}

async function tryGetModule(
  packageJson: PackageJson,
  workspaceRoot: string
): Promise<NxPlugin | null> {
  try {
    return packageJson.generators ??
      packageJson.executors ??
      packageJson['nx-migrations'] ??
      packageJson['schematics'] ??
      packageJson['builders']
      ? await loadNxPluginAsync(
          packageJson.name,
          getNxRequirePaths(workspaceRoot),
          workspaceRoot
        )
      : ({
          name: packageJson.name,
        } as NxPlugin);
  } catch {
    return null;
  }
}

export async function listPluginCapabilities(pluginName: string) {
  const plugin = await getPluginCapabilities(workspaceRoot, pluginName);

  if (!plugin) {
    const pmc = getPackageManagerCommand();
    output.note({
      title: `${pluginName} is not currently installed`,
      bodyLines: [
        `Use "${pmc.addDev} ${pluginName}" to install the plugin.`,
        `After that, use "${pmc.exec} nx g ${pluginName}:init" to add the required peer deps and initialize the plugin.`,
      ],
    });

    return;
  }

  const hasBuilders = hasElements(plugin.executors);
  const hasGenerators = hasElements(plugin.generators);
  const hasProjectGraphExtension = !!plugin.projectGraphExtension;
  const hasProjectInference = !!plugin.projectInference;

  if (
    !hasBuilders &&
    !hasGenerators &&
    !hasProjectGraphExtension &&
    !hasProjectInference
  ) {
    output.warn({ title: `No capabilities found in ${pluginName}` });
    return;
  }

  const bodyLines = [];

  if (hasGenerators) {
    bodyLines.push(chalk.bold(chalk.green('GENERATORS')));
    bodyLines.push('');
    bodyLines.push(
      ...Object.keys(plugin.generators).map(
        (name) => `${chalk.bold(name)} : ${plugin.generators[name].description}`
      )
    );
    if (hasBuilders) {
      bodyLines.push('');
    }
  }

  if (hasBuilders) {
    bodyLines.push(chalk.bold(chalk.green('EXECUTORS/BUILDERS')));
    bodyLines.push('');
    bodyLines.push(
      ...Object.keys(plugin.executors).map(
        (name) => `${chalk.bold(name)} : ${plugin.executors[name].description}`
      )
    );
  }

  if (hasProjectGraphExtension) {
    bodyLines.push(`✔️  Project Graph Extension`);
  }

  if (hasProjectInference) {
    bodyLines.push(`✔️  Project Inference`);
  }

  output.log({
    title: `Capabilities in ${plugin.name}:`,
    bodyLines,
  });
}
