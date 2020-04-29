import { terminal } from '@angular-devkit/core';
import * as path from 'path';
import { appRootPath } from '../app-root';
import { detectPackageManager } from '../detect-package-manager';
import { readJsonFile } from '../fileutils';
import { output } from '../output';
import { PluginCapabilities } from './models';
import { hasElements } from './shared';

function getPackageManagerInstallCommand(): string {
  let packageManager = detectPackageManager();
  let packageManagerInstallCommand = 'npm install --save-dev';
  switch (packageManager) {
    case 'yarn':
      packageManagerInstallCommand = 'yarn add --dev';
      break;

    case 'pnpm':
      packageManagerInstallCommand = 'pnpm install --save-dev';
      break;
  }
  return packageManagerInstallCommand;
}

function tryGetCollection<T>(
  pluginPath: string,
  jsonFile: string,
  propName: string
): T {
  if (!jsonFile) {
    return null;
  }

  try {
    return readJsonFile<T>(path.join(pluginPath, jsonFile))[propName];
  } catch {
    return null;
  }
}

export function getPluginCapabilities(
  workspaceRoot: string,
  pluginName: string
): PluginCapabilities {
  try {
    const pluginPath = path.join(workspaceRoot, 'node_modules', pluginName);
    const packageJson = readJsonFile(path.join(pluginPath, 'package.json'));
    return {
      name: pluginName,
      schematics: tryGetCollection(
        pluginPath,
        packageJson.schematics,
        'schematics'
      ),
      builders: tryGetCollection(pluginPath, packageJson.builders, 'builders'),
    };
  } catch {
    return null;
  }
}

export function listPluginCapabilities(pluginName: string) {
  const plugin = getPluginCapabilities(appRootPath, pluginName);

  if (!plugin) {
    output.note({
      title: `${pluginName} is not currently installed`,
      bodyLines: [
        `Use "${getPackageManagerInstallCommand()} ${pluginName}" to add new capabilities`,
      ],
    });

    return;
  }

  const hasBuilders = hasElements(plugin.builders);
  const hasSchematics = hasElements(plugin.schematics);

  if (!hasBuilders && !hasSchematics) {
    output.warn({ title: `No capabilities found in ${pluginName}` });
    return;
  }

  const bodyLines = [];

  if (hasSchematics) {
    bodyLines.push(terminal.bold(terminal.green('SCHEMATICS')));
    bodyLines.push('');
    bodyLines.push(
      ...Object.keys(plugin.schematics).map(
        (name) =>
          `${terminal.bold(name)} : ${plugin.schematics[name].description}`
      )
    );
    if (hasBuilders) {
      bodyLines.push('');
    }
  }

  if (hasBuilders) {
    bodyLines.push(terminal.bold(terminal.green('BUILDERS')));
    bodyLines.push('');
    bodyLines.push(
      ...Object.keys(plugin.builders).map(
        (name) =>
          `${terminal.bold(name)} : ${plugin.builders[name].description}`
      )
    );
  }

  output.log({
    title: `Capabilities in ${plugin.name}:`,
    bodyLines,
  });
}
