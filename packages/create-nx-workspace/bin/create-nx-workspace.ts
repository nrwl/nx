#!/usr/bin/env node

// we can import from '@nrwl/workspace' because it will require typescript
import { output } from '@nrwl/workspace/src/command-line/output';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import * as inquirer from 'inquirer';
import * as path from 'path';
import { dirSync } from 'tmp';
import * as yargsParser from 'yargs-parser';

const presetOptions = [
  {
    value: 'empty',
    name: 'empty             [an empty workspace]'
  },
  {
    value: 'web-components',
    name:
      'web components    [a workspace with a single app built using web components]'
  },
  {
    value: 'angular',
    name: 'angular           [a workspace with a single Angular application]'
  },
  {
    value: 'angular-nest',
    name:
      'angular-nest      [a workspace with a full stack application (Angular + Nest)]'
  },
  {
    value: 'react',
    name: 'react             [a workspace with a single React application]'
  },
  {
    value: 'react-express',
    name:
      'react-express     [a workspace with a full stack application (React + Express)]'
  }
];

const tsVersion = 'TYPESCRIPT_VERSION';
const cliVersion = 'NX_VERSION';
const nxVersion = 'NX_VERSION';
const angularCliVersion = 'ANGULAR_CLI_VERSION';

const parsedArgs = yargsParser(process.argv, {
  string: ['cli', 'preset', 'appName'],
  alias: {
    appName: 'app-name'
  },
  boolean: ['help']
});

if (parsedArgs.help) {
  showHelp();
  process.exit(0);
}
const packageManager = determinePackageManager();
determineWorkspaceName(parsedArgs).then(name => {
  determinePreset(parsedArgs).then(preset => {
    return determineAppName(preset, parsedArgs).then(appName => {
      return determineCli(preset, parsedArgs).then(cli => {
        const tmpDir = createSandbox(packageManager, cli);
        createApp(tmpDir, cli, parsedArgs, name, preset, appName);
        showNxWarning();
        showCliWarning(preset, parsedArgs);
      });
    });
  });
});

function showHelp() {
  console.log(`
  Usage: create-nx-workspace <name> [options] [new workspace options]

  Create a new Nx workspace

  Options:

    name                      workspace name

    preset                    What to create in a new workspace (options: ${presetOptions
      .map(o => '"' + o.value + '"')
      .join(', ')})

    appName                   the name of the application created by some presets  

    cli                       CLI to power the Nx workspace (options: "nx", "angular")

    [new workspace options]   any 'new workspace' options
`);
}

function determinePackageManager() {
  // If you have Angular CLI installed, read Angular CLI config.
  // If it isn't not installed, default to 'yarn'.
  let packageManager: string;
  try {
    packageManager = execSync('ng config -g cli.packageManager', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 500
    })
      .toString()
      .trim();
  } catch (e) {
    packageManager = 'yarn';
  }
  try {
    execSync(`${packageManager} --version`, {
      stdio: ['ignore', 'ignore', 'ignore']
    });
  } catch (e) {
    packageManager = 'npm';
  }
  return packageManager;
}

function determineWorkspaceName(parsedArgs: any) {
  const workspaceName = parsedArgs._[2];

  if (workspaceName) {
    return Promise.resolve(workspaceName);
  } else {
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

  return workspaceName;
}

function determinePreset(parsedArgs: any): Promise<string> {
  if (parsedArgs.preset) {
    if (presetOptions.map(o => o.value).indexOf(parsedArgs.preset) === -1) {
      output.error({
        title: 'Invalid preset',
        bodyLines: [
          `It must be one of the following:`,
          '',
          ...presetOptions.map(o => o.value)
        ]
      });
      process.exit(1);
    } else {
      return Promise.resolve(parsedArgs.preset);
    }
  } else {
    return inquirer
      .prompt([
        {
          name: 'Preset',
          message: `What to create in the new workspace`,
          default: 'empty',
          type: 'list',
          choices: presetOptions
        }
      ])
      .then(a => a.Preset);
  }
}

function determineAppName(preset: string, parsedArgs: any): Promise<string> {
  if (preset === 'empty') {
    return Promise.resolve('');
  }

  if (parsedArgs.appName) {
    return Promise.resolve(parsedArgs.appName);
  } else {
    return inquirer
      .prompt([
        {
          name: 'AppName',
          message: `Application name                   `,
          type: 'string'
        }
      ])
      .then(a => {
        if (!a.AppName) {
          output.error({
            title: 'Invalid name',
            bodyLines: [`Name cannot be empty`]
          });
          process.exit(1);
        }
        return a.AppName;
      });
  }
}

function determineCli(preset: string, parsedArgs: any) {
  const angular = {
    package: '@angular/cli',
    version: angularCliVersion,
    command: 'ng'
  };

  const nx = {
    package: '@nrwl/tao',
    version: cliVersion,
    command: 'tao'
  };

  if (parsedArgs.cli) {
    if (['nx', 'angular'].indexOf(parsedArgs.cli) === -1) {
      output.error({
        title: 'Invalid cli',
        bodyLines: [`It must be one of the following:`, '', 'nx', 'angular']
      });
      process.exit(1);
    }
    return Promise.resolve(parsedArgs.cli === 'angular' ? angular : nx);
  }

  if (preset == 'angular' || preset == 'angular-nest') {
    return Promise.resolve(angular);
  } else if (
    preset === 'web-components' ||
    preset === 'react' ||
    preset === 'react-express'
  ) {
    return Promise.resolve(nx);
  } else {
    return inquirer
      .prompt([
        {
          name: 'CLI',
          message: `CLI to power the Nx workspace      `,
          default: 'nx',
          type: 'list',
          choices: [
            {
              value: 'nx',
              name:
                'Nx           [Extensible CLI for JavaScript and TypeScript applications]'
            },

            {
              value: 'angular',
              name: 'Angular CLI  [Extensible CLI for Angular applications]'
            }
          ]
        }
      ])
      .then(a => (a.CLI === 'angular' ? angular : nx));
  }
}

function createSandbox(
  packageManager: string,
  cli: { package: string; version: string }
) {
  console.log(`Creating a sandbox with Nx...`);
  const tmpDir = dirSync().name;
  writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({
      dependencies: {
        '@nrwl/workspace': nxVersion,
        [cli.package]: cli.version,
        typescript: tsVersion
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

function createApp(
  tmpDir: string,
  cli: { command: string },
  parsedArgs: any,
  name: string,
  preset: string,
  appName: string
) {
  // creating the app itself
  const args = [
    name,
    ...process.argv
      .slice(parsedArgs._[2] ? 3 : 2)
      .filter(a => !a.startsWith('--cli')) // not used by the new command
      .map(a => `"${a}"`)
  ].join(' ');

  const presetArg = parsedArgs.preset
    ? ''
    : ` --preset=${preset} --appName=${appName}`;

  console.log(`new ${args}${presetArg} --collection=@nrwl/workspace`);
  execSync(
    `"${path.join(
      tmpDir,
      'node_modules',
      '.bin',
      cli.command
    )}" new ${args}${presetArg} --collection=@nrwl/workspace`,
    {
      stdio: [0, 1, 2]
    }
  );
}

function showNxWarning() {
  try {
    execSync('nx --version', { stdio: ['ignore', 'ignore', 'ignore'] });
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

function showCliWarning(preset: string, parsedArgs: any) {
  if (!parsedArgs.cli) {
    if (preset === 'angular' || preset === 'angular-nest') {
      output.addVerticalSeparator();
      output.note({
        title: `Because you selected an Angular-specific preset, we generated an Nx workspace powered by the Angular CLI.`,
        bodyLines: [
          `Run 'create-nx-workspace --help' to see how to select a different CLI.`
        ]
      });
    } else if (
      preset === 'web-components' ||
      preset === 'react' ||
      preset === 'react-express'
    ) {
      output.addVerticalSeparator();
      output.note({
        title: `We generated an Nx workspace powered by the Nx CLi.`,
        bodyLines: [
          `Run 'create-nx-workspace --help' to see how to select a different CLI.`
        ]
      });
    }
  }
}
