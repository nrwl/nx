import * as createSpinner from 'ora';
import { bold } from 'chalk';

import {
  getPackageManagerCommand,
  PackageManagerCommands,
} from '../../utils/package-manager';
import { GitRepository } from '../../utils/git-utils';
import { output } from '../../utils/output';
import { flushChanges, FsTree } from '../../generators/tree';
import {
  Generator as NxGenerator,
  GeneratorCallback,
} from '../../config/misc-interfaces';
import { getGeneratorInformation } from '../generate/generator-utils';
import { workspaceRoot } from '../../utils/workspace-root';
import { addDepsToPackageJson, runInstall } from './implementation/utils';

export function runPackageManagerInstallPlugins(
  repoRoot: string,
  pmc: PackageManagerCommands = getPackageManagerCommand(),
  plugins: string[]
) {
  if (plugins.length === 0) {
    return;
  }
  addDepsToPackageJson(repoRoot, plugins);
  runInstall(repoRoot, pmc);
}

/**
 * Install plugins
 * Get the implementation of the plugin's init generator and run it
 * @returns a list of succeeded plugins and a map of failed plugins to errors
 */
export async function installPlugins(
  plugins: string[],
  updatePackageScripts: boolean,
  repoRoot: string = workspaceRoot,
  verbose: boolean = false
): Promise<{
  succeededPlugins: string[];
  failedPlugins: { [plugin: string]: Error };
}> {
  if (plugins.length === 0) {
    return {
      succeededPlugins: [],
      failedPlugins: {},
    };
  }
  output.log({ title: '🔨 Configuring plugins' });
  const spinner = createSpinner();
  let succeededPlugins = [];
  const failedPlugins: {
    [pluginName: string]: Error;
  } = {};

  for (const plugin of plugins) {
    const host = new FsTree(repoRoot, verbose, `install ${plugin}`);
    spinner.start('Installing plugin ' + plugin);
    try {
      const { implementationFactory } = getGeneratorInformation(
        plugin,
        'init',
        repoRoot,
        {}
      );
      const implementation: NxGenerator = implementationFactory();
      const task: GeneratorCallback | void = await implementation(host, {
        keepExistingVersions: true,
        updatePackageScripts,
      });
      if (task) {
        await task();
      }
      succeededPlugins.push(plugin);
      spinner.succeed('Installed plugin ' + plugin);
      const changes = host.listChanges();
      flushChanges(repoRoot, changes);
    } catch (e) {
      failedPlugins[plugin] = e;
      spinner.fail('Failed to install plugin ' + plugin);
    }
  }

  return {
    succeededPlugins,
    failedPlugins,
  };
}

/**
 * Configures plugins, installs them, and outputs the results
 * @returns a list of succeeded plugins and a map of failed plugins to errors
 */
export async function configurePlugins(
  plugins: string[],
  updatePackageScripts: boolean,
  pmc: PackageManagerCommands,
  repoRoot: string = workspaceRoot,
  verbose: boolean = false,
  destinationGitClient?: GitRepository
): Promise<{
  succeededPlugins: string[];
  failedPlugins: { [plugin: string]: Error };
}> {
  if (plugins.length === 0) {
    return {
      succeededPlugins: [],
      failedPlugins: {},
    };
  }

  let { succeededPlugins, failedPlugins } = await installPlugins(
    plugins,
    updatePackageScripts,
    repoRoot,
    verbose
  );

  if (succeededPlugins.length > 0) {
    if (destinationGitClient) {
      destinationGitClient.amendCommit();
    }
    output.success({
      title: 'Installed Plugins',
      bodyLines: succeededPlugins.map((p) => `- ${bold(p)}`),
    });
  }
  if (Object.keys(failedPlugins).length > 0) {
    output.error({
      title: `Failed to install plugins`,
      bodyLines: [
        'The following plugins were not installed:',
        ...Object.keys(failedPlugins).map((p) => `- ${bold(p)}`),
      ],
    });
    Object.entries(failedPlugins).forEach(([plugin, error]) => {
      output.error({
        title: `Failed to install ${plugin}`,
        bodyLines: [error.stack ?? error.message ?? error.toString()],
      });
    });
    output.error({
      title: `To install the plugins manually`,
      bodyLines: [
        'You may need to run commands to install the plugins:',
        ...Object.keys(failedPlugins).map(
          (p) => `- ${bold(pmc.exec + ' nx add ' + p)}`
        ),
      ],
    });
  }
  return { succeededPlugins, failedPlugins };
}
