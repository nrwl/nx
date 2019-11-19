import yargs = require('yargs');
import { terminal } from '@angular-devkit/core';
import { appRootPath } from '../utils/app-root';
import { detectPackageManager } from '../utils/detect-package-manager';
import {
  getPluginCapabilities,
  getPluginVersion,
  readCapabilitiesFromNodeModules
} from '../utils/plugin-utils';
import { approvedPlugins } from '../utils/plugins';
import { output } from './output';

export interface YargsListArgs extends yargs.Arguments, ListArgs {}

interface ListArgs {
  plugin?: string;
}

export const list = {
  command: 'list [plugin]',
  describe:
    'Lists installed plugins, capabilities of installed plugins and other available plugins.',
  builder: (yargs: yargs.Argv) =>
    yargs.positional('plugin', {
      default: null,
      description: 'The name of an installed plugin to query'
    }),
  handler: listHandler
};

/**
 * List available plugins or capabilities within a specific plugin
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
async function listHandler(args: YargsListArgs) {
  if (args.plugin) {
    listCapabilities(args.plugin);
  } else {
    listPlugins();
  }
}

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

function hasElements(obj: any): boolean {
  return obj && Object.values(obj).length > 0;
}

function listCapabilities(pluginName: string) {
  const plugin = getPluginCapabilities(appRootPath, pluginName);

  if (!plugin) {
    const approvedPlugin = approvedPlugins.find(p => p.name === pluginName);
    if (approvedPlugin) {
      const installedPlugins = readCapabilitiesFromNodeModules(appRootPath);

      let workspaceVersion = 'latest';
      if (installedPlugins.some(x => x.name === '@nrwl/workspace')) {
        workspaceVersion = getPluginVersion(appRootPath, '@nrwl/workspace');
      }

      output.note({
        title: `${pluginName} is not currently installed`,
        bodyLines: [
          `Use "${getPackageManagerInstallCommand()} ${pluginName}@${workspaceVersion}" to add new capabilities`,
          '',
          `Visit ${terminal.bold(
            approvedPlugin.link ? approvedPlugin.link : 'https://nx.dev/'
          )} for more information`
        ]
      });
    } else {
      output.error({
        title: `Could not find plugin ${pluginName}`
      });
    }
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
        name =>
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
        name => `${terminal.bold(name)} : ${plugin.builders[name].description}`
      )
    );
  }

  output.log({
    title: `Capabilities in ${plugin.name} :`,
    bodyLines
  });
}

function listPlugins() {
  const installedPlugins = readCapabilitiesFromNodeModules(appRootPath);

  // The following packages are present in any workspace. Hide them to avoid confusion.
  const hide = [
    '@angular-devkit/architect',
    '@angular-devkit/build-ng-packagr',
    '@angular-devkit/build-webpack',
    '@angular-eslint/builder'
  ];

  const filtered = installedPlugins.filter(p => hide.indexOf(p.name) === -1);

  output.log({
    title: `Installed plugins :`,
    bodyLines: filtered.map(p => {
      const capabilities = [];
      if (hasElements(p.builders)) {
        capabilities.push('builders');
      }
      if (hasElements(p.schematics)) {
        capabilities.push('schematics');
      }
      return `${terminal.bold(p.name)} (${capabilities.join()})`;
    })
  });

  const pluginMap: Set<string> = new Set<string>(
    installedPlugins.map(p => p.name)
  );
  const alsoAvailable = approvedPlugins.filter(p => !pluginMap.has(p.name));

  if (alsoAvailable.length) {
    output.log({
      title: `Also available :`,
      bodyLines: alsoAvailable.map(p => {
        return `${terminal.bold(p.name)} (${p.capabilities})`;
      })
    });
  }

  output.note({
    title: `Use "nx list [plugin]" to find out more`
  });
}
