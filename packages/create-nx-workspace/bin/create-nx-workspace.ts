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
    value: 'angular',
    name: 'angular           [a workspace with a single Angular application]'
  },
  {
    value: 'react',
    name: 'react             [a workspace with a single React application]'
  },
  {
    value: 'web-components',
    name:
      'web components    [a workspace with a single app built using web components]'
  },
  {
    value: 'full-stack',
    name:
      'full-stack        [a workspace with a full stack application (NestJS + Angular Ivy)]'
  }
];

const tsVersion = 'TYPESCRIPT_VERSION';
const cliVersion = 'NX_VERSION';
const nxVersion = 'NX_VERSION';
const angularCliVersion = 'ANGULAR_CLI_VERSION';

const parsedArgs = yargsParser(process.argv, {
  string: ['cli', 'preset'],
  boolean: ['help']
});

if (parsedArgs.help) {
  showHelp();
  process.exit(0);
}
validateInput(parsedArgs);
const packageManager = determinePackageManager();
determinePreset(parsedArgs).then(preset => {
  return determineCli(preset, parsedArgs).then(cli => {
    const tmpDir = createSandbox(packageManager, cli);
    createApp(tmpDir, cli, parsedArgs, preset);
    showNxWarning();
    showCliWarning(preset, parsedArgs);
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

function validateInput(parsedArgs: any) {
  const projectName = parsedArgs._[2];

  if (!projectName) {
    output.error({
      title: 'A project name is required when creating a new workspace',
      bodyLines: [
        output.colors.gray('For example:'),
        '',
        `${output.colors.gray('>')} create-nx-workspace my-new-workspace`
      ]
    });
    process.exit(1);
  }

  return projectName;
}

function determinePreset(parsedArgs: any): Promise<string> {
  if (parsedArgs.preset) {
    if (presetOptions.map(o => o.value).indexOf(parsedArgs.preset) === -1) {
      console.error(
        `Invalid preset. It must be one of the following: ${presetOptions
          .map(o => '"' + o.value + '"')
          .join(', ')}.`
      );
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
      console.error(
        `Invalid cli. It must be one of the following: "nx", "angular".`
      );
      process.exit(1);
    }
    return Promise.resolve(parsedArgs.cli === 'angular' ? angular : nx);
  }

  if (preset == 'angular' || preset == 'full-stack') {
    return Promise.resolve(angular);
  } else if (preset === 'web-components' || preset === 'react') {
    return Promise.resolve(nx);
  } else {
    return inquirer
      .prompt([
        {
          name: 'CLI',
          message: `CLI to power the Nx workspace`,
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
  preset: string
) {
  // creating the app itself
  const args = process.argv
    .slice(2)
    .filter(a => !a.startsWith('--cli')) // not used by the new command
    .map(a => `"${a}"`)
    .join(' ');

  const presetArg = parsedArgs.preset ? '' : ` --preset=${preset}`;

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
    console.log('-----------------------------------------------------------');
    console.log(`It looks like you don't have the Nx CLI installed globally.`);
    console.log(
      `This means that you might have to use "yarn nx" or "npm nx" to execute commands in your workspace.`
    );
    console.log(
      `If you want to execute the nx command directly, run "yarn global add @nrwl/cli" or "npm install -g @nrwl/cli"`
    );
    console.log('-----------------------------------------------------------');
  }
}

function showCliWarning(preset: string, parsedArgs: any) {
  if (!parsedArgs.cli) {
    if (preset == 'angular' || preset == 'full-stack') {
      console.log(
        'Because you selected an Angular-specific preset, we generated an Nx workspace powered by the Angular CLi.'
      );
      console.log(
        `If you want want to power the workspace using a different CLI, you can pass it using '--cli'. Find out more by running 'create-nx-workspace --help'.`
      );
    } else if (preset === 'web-components' || preset === 'react') {
      console.log('We generated an Nx workspace powered by the Nx CLi.');
      console.log(
        `If you want want to power the workspace using a different CLI, you can pass it using '--cli'. Find out more by running 'create-nx-workspace --help'.`
      );
    }
  }
}
