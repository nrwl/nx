import { workspaceRoot } from '../workspace-root';
import * as chalk from 'chalk';
import { dirname, join } from 'path';
import { output } from '../output';
import type { PluginCapabilities } from './models';
import { hasElements } from './shared';
import { readJsonFile } from '../fileutils';
import { getPackageManagerCommand } from '../package-manager';
import { loadNxPlugin, readPluginPackageJson } from '../nx-plugin';
import { getNxRequirePaths } from '../installation-directory';
import { GeneratorsJson, ExecutorsJson } from '../../config/misc-interfaces';

function tryGetCollection<T extends object, TKey extends keyof T>(
  packageJsonPath: string,
  collectionFile: string | undefined,
  propName: TKey
): T[TKey] | null {
  if (!collectionFile) {
    return null;
  }

  try {
    const collectionFilePath = join(dirname(packageJsonPath), collectionFile);
    return readJsonFile(collectionFilePath)[propName];
  } catch {
    return null;
  }
}

export function getPluginCapabilities(
  workspaceRoot: string,
  pluginName: string
): PluginCapabilities | null {
  try {
    const { json: packageJson, path: packageJsonPath } = readPluginPackageJson(
      pluginName,
      getNxRequirePaths(workspaceRoot)
    );
    const pluginModule = loadNxPlugin(
      pluginName,
      getNxRequirePaths(workspaceRoot),
      workspaceRoot
    );
    return {
      name: pluginName,
      generators:
        tryGetCollection<GeneratorsJson, 'generators'>(
          packageJsonPath,
          packageJson.generators,
          'generators'
        ) ||
        tryGetCollection<GeneratorsJson, 'schematics'>(
          packageJsonPath,
          packageJson.generators,
          'schematics'
        ) ||
        tryGetCollection<GeneratorsJson, 'generators'>(
          packageJsonPath,
          packageJson.schematics,
          'generators'
        ) ||
        tryGetCollection<GeneratorsJson, 'schematics'>(
          packageJsonPath,
          packageJson.schematics,
          'schematics'
        ),
      executors:
        tryGetCollection<ExecutorsJson, 'executors'>(packageJsonPath, packageJson.executors, 'executors') ||
        tryGetCollection<ExecutorsJson, 'builders'>(packageJsonPath, packageJson.executors, 'builders') ||
        tryGetCollection<ExecutorsJson, 'executors'>(packageJsonPath, packageJson.builders, 'executors') ||
        tryGetCollection<ExecutorsJson, 'builders'>(packageJsonPath, packageJson.builders, 'builders'),
      projectGraphExtension: !!pluginModule.processProjectGraph,
      projectInference: !!pluginModule.projectFilePatterns,
    };
  } catch {
    return null;
  }
}

export function listPluginCapabilities(pluginName: string) {
  const plugin = getPluginCapabilities(workspaceRoot, pluginName);

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
      ...Object.keys(plugin.generators ?? {}).map(
        (name) => `${chalk.bold(name)} : ${plugin.generators?.[name].description}`
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
      ...Object.keys(plugin.executors ?? {}).map(
        (name) =>
          `${chalk.bold(name)} : ${plugin.executors?.[name].description}`
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
