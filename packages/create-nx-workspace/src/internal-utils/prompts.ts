import * as yargs from 'yargs';
import { messages } from '../utils/nx/ab-testing';
import { CI } from '../utils/ci/ci-list';
import { output } from '../utils/output';
import { deduceDefaultBase } from '../utils/git/default-base';
import {
  detectInvokedPackageManager,
  PackageManager,
  packageManagerList,
} from '../utils/package-manager';
import { stringifyCollection } from '../utils/string-utils';
import enquirer = require('enquirer');

export async function determineNxCloud(
  parsedArgs: yargs.Arguments<{ nxCloud: boolean }>
): Promise<boolean> {
  if (parsedArgs.nxCloud === undefined) {
    return enquirer
      .prompt<{ NxCloud: 'Yes' | 'No' }>([
        {
          name: 'NxCloud',
          message: messages.getPromptMessage('nxCloudCreation'),
          type: 'autocomplete',
          choices: [
            {
              name: 'Yes',
              hint: 'I want faster builds',
            },

            {
              name: 'No',
            },
          ],
          initial: 'Yes' as any,
        },
      ])
      .then((a) => a.NxCloud === 'Yes');
  } else {
    return parsedArgs.nxCloud;
  }
}

export async function determineCI(
  parsedArgs: yargs.Arguments<{ ci?: CI; allPrompts?: boolean }>,
  nxCloud: boolean
): Promise<string> {
  if (!nxCloud) {
    if (parsedArgs.ci) {
      output.warn({
        title: 'Invalid CI value',
        bodyLines: [
          `CI option only works when Nx Cloud is enabled.`,
          `The value provided will be ignored.`,
        ],
      });
    }
    return '';
  }

  if (parsedArgs.ci) {
    return parsedArgs.ci;
  }

  if (parsedArgs.allPrompts) {
    return (
      enquirer
        .prompt<{ CI: string }>([
          {
            name: 'CI',
            message: `CI workflow file to generate?      `,
            type: 'autocomplete',
            initial: '' as any,
            choices: [
              { message: 'none', name: '' },
              { message: 'GitHub Actions', name: 'github' },
              { message: 'Circle CI', name: 'circleci' },
              { message: 'Azure DevOps', name: 'azure' },
            ],
          },
        ])
        // enquirer ignores name and value if they are falsy and takes
        // first field that has a truthy value, so wee need to explicitly
        // check for none
        .then((a: { CI: string }) => (a.CI !== 'none' ? a.CI : ''))
    );
  }
  return '';
}

export async function determineDefaultBase(
  parsedArgs: yargs.Arguments<{ defaultBase?: string }>
): Promise<string> {
  if (parsedArgs.defaultBase) {
    return Promise.resolve(parsedArgs.defaultBase);
  }
  if (parsedArgs.allPrompts) {
    return enquirer
      .prompt<{ DefaultBase: string }>([
        {
          name: 'DefaultBase',
          message: `Main branch name`,
          initial: `main`,
          type: 'input',
        },
      ])
      .then((a) => {
        if (!a.DefaultBase) {
          output.error({
            title: 'Invalid branch name',
            bodyLines: [`Branch name cannot be empty`],
          });
          process.exit(1);
        }
        return a.DefaultBase;
      });
  }
  return Promise.resolve(deduceDefaultBase());
}

export async function determinePackageManager(
  parsedArgs: yargs.Arguments<{ packageManager: string }>
): Promise<PackageManager> {
  const packageManager: string = parsedArgs.packageManager;

  if (packageManager) {
    if (packageManagerList.includes(packageManager as PackageManager)) {
      return Promise.resolve(packageManager as PackageManager);
    }
    output.error({
      title: 'Invalid package manager',
      bodyLines: [
        `Package manager must be one of ${stringifyCollection([
          ...packageManagerList,
        ])}`,
      ],
    });
    process.exit(1);
  }

  if (parsedArgs.allPrompts) {
    return enquirer
      .prompt<{ packageManager: PackageManager }>([
        {
          name: 'packageManager',
          message: `Which package manager to use`,
          initial: 'npm' as any,
          type: 'autocomplete',
          choices: [
            { name: 'npm', message: 'NPM' },
            { name: 'yarn', message: 'Yarn' },
            { name: 'pnpm', message: 'PNPM' },
          ],
        },
      ])
      .then((a) => a.packageManager);
  }

  return Promise.resolve(detectInvokedPackageManager());
}
