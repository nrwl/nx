#!/usr/bin/env node

import { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';
import { output } from 'nx/src/utils/output';
import {
  PackageManager,
  getPackageManagerCommand,
  PackageManagerCommands,
} from 'nx/src/utils/package-manager';
import { NxJsonConfiguration } from 'nx/src/config/nx-json';
import { execSync } from 'child_process';
import { removeSync } from 'fs-extra';
import * as path from 'path';
import { dirSync } from 'tmp';
import { prompt } from 'enquirer';
import yargsParser = require('yargs-parser');

const supportedPackageManagers: PackageManager[] = ['pnpm', 'yarn', 'npm'];

const nxVersion = require('../package.json').version;
const tsVersion = 'TYPESCRIPT_VERSION'; // This gets replaced with the typescript version in the root package.json during build
const prettierVersion = 'PRETTIER_VERSION'; // This gets replaced with the prettier version in the root package.json during build

const parsedArgs = yargsParser(process.argv, {
  string: ['pluginName', 'packageManager', 'importPath'],
  alias: {
    importPath: 'import-path',
    pluginName: 'plugin-name',
    packageManager: 'pm',
  },
  boolean: ['help'],
});

function createSandbox(packageManager: PackageManager) {
  console.log(`Creating a sandbox with Nx...`);
  const tmpDir = dirSync().name;
  writeJsonFile(path.join(tmpDir, 'package.json'), {
    dependencies: {
      '@nrwl/workspace': nxVersion,
      nx: nxVersion,
      typescript: tsVersion,
      prettier: prettierVersion,
    },
    license: 'MIT',
  });

  execSync(`${packageManager} install --silent`, {
    cwd: tmpDir,
    stdio: [0, 1, 2],
  });

  return tmpDir;
}

function createWorkspace(
  tmpDir: string,
  pmc: PackageManagerCommands,
  parsedArgs: yargsParser.Arguments,
  name: string
) {
  // Ensure to use packageManager for args
  // if it's not already passed in from previous process
  if (!parsedArgs.packageManager) {
    parsedArgs.packageManager = packageManager;
  }

  const args = [
    name,
    ...process.argv.slice(parsedArgs._[2] ? 3 : 2).map((a) => `"${a}"`),
  ].join(' ');

  const command = `new ${args} --preset=empty --collection=@nrwl/workspace`;
  console.log(command);

  execSync(
    `${
      pmc.exec
    } nx ${command}/generators.json --nxWorkspaceRoot="${process.cwd()}"`,
    {
      stdio: [0, 1, 2],
      cwd: tmpDir,
    }
  );
  execSync(`${packageManager} add -D @nrwl/nx-plugin@${nxVersion}`, {
    cwd: name,
    stdio: [0, 1, 2],
  });
}

function createNxPlugin(
  workspaceName: string,
  pluginName: string,
  pmc: PackageManagerCommands,
  parsedArgs: yargsParser.Arguments
) {
  const importPath = parsedArgs.importPath ?? `@${workspaceName}/${pluginName}`;
  const command = `nx generate @nrwl/nx-plugin:plugin ${pluginName} --importPath=${importPath}`;
  console.log(command);

  execSync(`${pmc.exec} ${command}`, {
    cwd: workspaceName,
    stdio: [0, 1, 2],
  });
}

function updateWorkspace(workspaceName: string) {
  const nxJsonPath = path.join(workspaceName, 'nx.json');
  const nxJson = readJsonFile<NxJsonConfiguration>(nxJsonPath);

  nxJson.workspaceLayout = {
    appsDir: 'e2e',
    libsDir: 'packages',
  };

  writeJsonFile(nxJsonPath, nxJson);

  removeSync(path.join(workspaceName, 'apps'));
  removeSync(path.join(workspaceName, 'libs'));
}

function commitChanges(workspaceName: string) {
  execSync('git add .', {
    cwd: workspaceName,
    stdio: 'ignore',
  });
  execSync('git commit --amend --no-edit', {
    cwd: workspaceName,
    stdio: 'ignore',
  });
}

async function determineWorkspaceName(
  parsedArgs: yargsParser.Arguments
): Promise<string> {
  const workspaceName: string | number = parsedArgs._[2];

  if (workspaceName) {
    return workspaceName.toString();
  }

  const result = await prompt<{ WorkspaceName: string }>([
    {
      name: 'WorkspaceName',
      message: `Workspace name (e.g., org name)    `,
      type: 'input',
    },
  ]);
  if (!result.WorkspaceName) {
    output.error({
      title: 'Invalid workspace name',
      bodyLines: [`Workspace name cannot be empty`],
    });
    process.exit(1);
  }
  return result.WorkspaceName;
}

async function determinePluginName(parsedArgs: yargsParser.Arguments) {
  if (parsedArgs.pluginName) {
    return Promise.resolve(parsedArgs.pluginName);
  }

  const res = await prompt<{ PluginName: string }>([
    {
      name: 'PluginName',
      message: `Plugin name                        `,
      type: 'input',
    },
  ]);

  if (!res.PluginName) {
    output.error({
      title: 'Invalid name',
      bodyLines: [`Name cannot be empty`],
    });
    process.exit(1);
  }
  return res.PluginName;
}

/**
 * Detects which package manager was used to invoke create-nx-{plugin|workspace} command
 * based on the main Module process that invokes the command
 * - npx returns 'npm'
 * - pnpx returns 'pnpm'
 * - yarn create returns 'yarn'
 *
 * Default to 'npm'
 */
export function detectInvokedPackageManager(): PackageManager {
  // mainModule is deprecated since Node 14, fallback for older versions
  const invoker = require.main || process['mainModule'];

  if (invoker) {
    for (const pkgManager of supportedPackageManagers) {
      if (invoker.path.includes(pkgManager)) {
        return pkgManager;
      }
    }
  }

  return 'npm';
}

function showNxWarning(workspaceName: string) {
  try {
    const pathToRunNxCommand = path.resolve(process.cwd(), workspaceName);
    execSync('nx --version', {
      cwd: pathToRunNxCommand,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch {
    // no nx found
    output.addVerticalSeparator();
    output.note({
      title: `Nx CLI is not installed globally.`,
      bodyLines: [
        `This means that you might have to use "yarn nx" or "npx nx" to execute commands in the workspace.`,
        `Run "yarn global add nx" or "npm install -g nx" to be able to execute command directly.`,
      ],
    });
  }
}

function showHelp() {
  console.log(`
  Usage:  <name> [options]

  Create a new Nx workspace

  Args:

    name           workspace name (e.g., org name)

  Options:

    pluginName     the name of the plugin to be created
`);
}

if (parsedArgs.help) {
  showHelp();
  process.exit(0);
}

const packageManager: PackageManager =
  parsedArgs.packageManager &&
  typeof parsedArgs.packageManager === 'string' &&
  supportedPackageManagers.includes(
    parsedArgs.packageManager.trim() as PackageManager
  )
    ? (parsedArgs.packageManager.trim() as PackageManager)
    : detectInvokedPackageManager();

determineWorkspaceName(parsedArgs).then(async (workspaceName) => {
  const pluginName = await determinePluginName(parsedArgs);
  const tmpDir = createSandbox(packageManager);
  const pmc = getPackageManagerCommand(packageManager);
  createWorkspace(tmpDir, pmc, parsedArgs, workspaceName);
  updateWorkspace(workspaceName);
  createNxPlugin(workspaceName, pluginName, pmc, parsedArgs);
  commitChanges(workspaceName);
  showNxWarning(workspaceName);
});
