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
  GeneratorsJsonEntry,
} from '../../config/misc-interfaces';
import { getGeneratorInformation } from '../generate/generator-utils';
import { workspaceRoot } from '../../utils/workspace-root';
import { addDepsToPackageJson, runInstall } from './implementation/utils';
import { getPluginCapabilities } from '../../utils/plugins';
import { isAngularPluginInstalled } from '../../adapter/angular-json';
import {
  isAggregateCreateNodesError,
  isProjectConfigurationsError,
  isProjectsWithNoNameError,
} from '../../project-graph/error-types';

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
 * Installs a plugin by running its init generator. It will change the file system tree passed in.
 * @param plugin The name of the plugin to install
 * @param repoRoot repo root
 * @param verbose verbose
 * @param options options passed to init generator
 * @returns void
 */
export async function installPlugin(
  plugin: string,
  repoRoot: string = workspaceRoot,
  verbose: boolean = false,
  options: { [k: string]: any }
): Promise<void> {
  const host = new FsTree(repoRoot, verbose, `install ${plugin}`);
  const capabilities = await getPluginCapabilities(repoRoot, plugin, {});
  const generators = capabilities?.generators;
  if (!generators) {
    throw new Error(`No generators found in ${plugin}.`);
  }

  const initGenerator = findInitGenerator(generators);
  if (!initGenerator) {
    output.log({
      title: `No "init" generator found in ${plugin}. Skipping initialization.`,
    });
    return;
  }
  const { implementationFactory } = getGeneratorInformation(
    plugin,
    initGenerator,
    repoRoot,
    {}
  );

  const implementation: NxGenerator = implementationFactory();
  const task: GeneratorCallback | void = await implementation(host, options);
  flushChanges(repoRoot, host.listChanges());
  if (task) {
    await task();
  }
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
  const spinner = createSpinner();
  let succeededPlugins = [];
  const failedPlugins: {
    [pluginName: string]: Error;
  } = {};

  for (const plugin of plugins) {
    try {
      spinner.start('Installing plugin ' + plugin);
      await installPlugin(plugin, repoRoot, verbose, {
        keepExistingVersions: true,
        updatePackageScripts,
        addPlugin: true,
        skipFormat: false,
        skipPackageJson: false,
      });
      succeededPlugins.push(plugin);
      spinner.succeed('Installed plugin ' + plugin);
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
  let { succeededPlugins, failedPlugins } = await installPlugins(
    plugins,
    updatePackageScripts,
    repoRoot,
    verbose
  );

  if (succeededPlugins.length > 0) {
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
        bodyLines: getFailedToInstallPluginErrorMessages(error),
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

function findInitGenerator(
  generators: Record<string, GeneratorsJsonEntry>
): string | undefined {
  if (generators['init']) {
    return 'init';
  }

  const angularPluginInstalled = isAngularPluginInstalled();
  if (angularPluginInstalled && generators['ng-add']) {
    return 'ng-add';
  }

  return Object.keys(generators).find(
    (name) =>
      generators[name].aliases?.includes('init') ||
      (angularPluginInstalled && generators[name].aliases?.includes('ng-add'))
  );
}

export function getFailedToInstallPluginErrorMessages(e: any): string[] {
  const errorBodyLines = [];
  if (isProjectConfigurationsError(e) && e.errors.length > 0) {
    for (const error of e.errors) {
      if (isAggregateCreateNodesError(error)) {
        const innerErrors = error.errors;
        for (const [file, e] of innerErrors) {
          if (file) {
            errorBodyLines.push(`  - ${bold(file)}: ${e.message}`);
          } else {
            errorBodyLines.push(`  - ${e.message}`);
          }
          if (e.stack) {
            const innerStackTrace =
              '    ' + e.stack.split('\n')?.join('\n    ');
            errorBodyLines.push(innerStackTrace);
          }
        }
      } else if (!isProjectsWithNoNameError(error)) {
        // swallow ProjectsWithNameError
        if (error.message) {
          errorBodyLines.push(`  - ${error.message}`);
        }
        if (error.stack) {
          const innerStackTrace =
            '    ' + error.stack.split('\n')?.join('\n    ');
          errorBodyLines.push(innerStackTrace);
        }
      }
    }
  } else {
    if (e.message) {
      errorBodyLines.push(`  - ${e.message}`);
    }
    if (e.stack) {
      const innerStackTrace = '    ' + e.stack.split('\n')?.join('\n    ');
      errorBodyLines.push(innerStackTrace);
    }
  }
  return errorBodyLines;
}
