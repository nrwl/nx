#!/usr/bin/env node

// we can import from '@nrwl/workspace' because it will require typescript
import { output } from '@nrwl/workspace/src/utils/output';
import { dirSync } from 'tmp';
import { writeFileSync } from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import * as inquirer from 'inquirer';
import yargsParser = require('yargs-parser');

const tsVersion = 'TYPESCRIPT_VERSION';
const cliVersion = 'NX_VERSION';
const nxVersion = 'NX_VERSION';
const prettierVersion = 'PRETTIER_VERSION';

const parsedArgs = yargsParser(process.argv, {
  string: ['pluginName'],
  alias: {
    pluginName: 'plugin-name'
  },
  boolean: ['help']
});

if (parsedArgs.help) {
  showHelp();
  process.exit(0);
}

const packageManager = determinePackageManager();
determineWorkspaceName(parsedArgs).then(workspaceName => {
  return determinPluginName(parsedArgs).then(pluginName => {
    const tmpDir = createSandbox(packageManager);
    createWorkspace(tmpDir, packageManager, parsedArgs, workspaceName);
    createNxPlugin(workspaceName, pluginName);
    commitChanges(workspaceName);
    showNxWarning(workspaceName);
  });
});

function createSandbox(packageManager: string) {
  console.log(`Creating a sandbox with Nx...`);
  const tmpDir = dirSync().name;
  writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({
      dependencies: {
        '@nrwl/workspace': nxVersion,
        '@nrwl/tao': cliVersion,
        typescript: tsVersion,
        prettier: prettierVersion
      },
      license: 'MIT'
    })
  );

  execSync(`${packageManager} install --silent`, {
    cwd: tmpDir,
    stdio: [0, 1, 2]
  });

  return tmpDir;
}

function createWorkspace(
  tmpDir: string,
  packageManager: string,
  parsedArgs: any,
  name: string
) {
  const args = [
    name,
    ...process.argv.slice(parsedArgs._[2] ? 3 : 2).map(a => `"${a}"`)
  ].join(' ');

  console.log(`new ${args} --preset=empty --collection=@nrwl/workspace`);
  execSync(
    `"${path.join(
      tmpDir,
      'node_modules',
      '.bin',
      'tao'
    )}" new ${args} --preset=empty --collection=@nrwl/workspace`,
    {
      stdio: [0, 1, 2]
    }
  );
  execSync(`${packageManager} add -D @nrwl/nx-plugin@${nxVersion}`, {
    cwd: name,
    stdio: [0, 1, 2]
  });
}

function createNxPlugin(workspaceName, pluginName) {
  console.log(`nx generate @nrwl/nx-plugin:plugin ${pluginName}`);
  execSync(
    `node ./node_modules/@nrwl/cli/bin/nx.js generate @nrwl/nx-plugin:plugin ${pluginName}`,
    {
      cwd: workspaceName,
      stdio: [0, 1, 2]
    }
  );
}

function commitChanges(workspaceName) {
  execSync('git add .', {
    cwd: workspaceName,
    stdio: 'ignore'
  });
  execSync('git commit --amend --no-edit', {
    cwd: workspaceName,
    stdio: 'ignore'
  });
}

function showNxWarning(workspaceName: string) {
  try {
    const pathToRunNxCommand = path.resolve(process.cwd(), workspaceName);
    execSync('nx --version', {
      cwd: pathToRunNxCommand,
      stdio: ['ignore', 'ignore', 'ignore']
    });
  } catch (e) {
    // no nx found
    output.addVerticalSeparator();
    output.note({
      title: `Nx CLI is not installed globally.`,
      bodyLines: [
        `This means that you might have to use "yarn nx" or "npm nx" to execute commands in the workspace.`,
        `Run "yarn global add @nrwl/cli" or "npm install -g @nrwl/cli" to be able to execute command directly.`
      ]
    });
  }
}

// Move to @nrwl/workspace package?
function determinePackageManager() {
  let packageManager = getPackageManagerFromAngularCLI();
  if (packageManager === 'npm' || isPackageManagerInstalled(packageManager)) {
    return packageManager;
  }

  if (isPackageManagerInstalled('yarn')) {
    return 'yarn';
  }

  if (isPackageManagerInstalled('pnpm')) {
    return 'pnpm';
  }

  return 'npm';
}

function getPackageManagerFromAngularCLI(): string {
  // If you have Angular CLI installed, read Angular CLI config.
  // If it isn't installed, default to 'yarn'.
  try {
    return execSync('ng config -g cli.packageManager', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 500
    })
      .toString()
      .trim();
  } catch (e) {
    return 'yarn';
  }
}

function isPackageManagerInstalled(packageManager: string) {
  let isInstalled = false;
  try {
    execSync(`${packageManager} --version`, {
      stdio: ['ignore', 'ignore', 'ignore']
    });
    isInstalled = true;
  } catch (e) {
    /* do nothing */
  }
  return isInstalled;
}

function determineWorkspaceName(parsedArgs: any): Promise<string> {
  const workspaceName: string = parsedArgs._[2];

  if (workspaceName) {
    return Promise.resolve(workspaceName);
  }

  return inquirer
    .prompt([
      {
        name: 'WorkspaceName',
        message: `Workspace name (e.g., org name)    `,
        type: 'string'
      }
    ])
    .then(a => {
      if (!a.WorkspaceName) {
        output.error({
          title: 'Invalid workspace name',
          bodyLines: [`Workspace name cannot be empty`]
        });
        process.exit(1);
      }
      return a.WorkspaceName;
    });
}

function determinPluginName(parsedArgs) {
  if (parsedArgs.pluginName) {
    return Promise.resolve(parsedArgs.pluginName);
  }

  return inquirer
    .prompt([
      {
        name: 'PluginName',
        message: `Plugin name                   `,
        type: 'string'
      }
    ])
    .then(a => {
      if (!a.PluginName) {
        output.error({
          title: 'Invalid name',
          bodyLines: [`Name cannot be empty`]
        });
        process.exit(1);
      }
      return a.PluginName;
    });
}

function showHelp() {
  console.log(`
  Usage:  <name> [options]

  Create a new Nx workspace

  Args: 

    name           workspace name

  Options:

    pluginName     the name of the plugin to be created  
`);
}
