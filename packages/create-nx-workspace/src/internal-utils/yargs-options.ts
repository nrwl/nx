import chalk = require('chalk');
import yargs = require('yargs');
import { CreateWorkspaceOptions } from '../create-workspace-options';
import { ciList } from '../utils/ci/ci-list';
import { messages } from '../utils/nx/ab-testing';
import { packageManagerList } from '../utils/package-manager';

export function withNxCloud<T = unknown>(argv: yargs.Argv<T>) {
  const result = argv.option('nxCloud', {
    describe: chalk.dim(messages.getPromptMessage('nxCloudCreation')),
    type: 'boolean',
  });
  return result;
}

export function withCI<T = unknown>(argv: yargs.Argv<T>) {
  return argv.option('ci', {
    describe: chalk.dim`Generate a CI workflow file`,
    choices: ciList,
    defaultDescription: '',
    type: 'string',
  });
}

export function withAllPrompts<T = unknown>(argv: yargs.Argv<T>) {
  return argv.option('allPrompts', {
    alias: 'a',
    describe: chalk.dim`Show all prompts`,
    type: 'boolean',
    default: false,
  });
}

export function withPackageManager<T = unknown>(argv: yargs.Argv<T>) {
  return argv.option('packageManager', {
    alias: 'pm',
    describe: chalk.dim`Package manager to use`,
    choices: [...packageManagerList].sort(),
    defaultDescription: 'npm',
    type: 'string',
  });
}

export function withGitOptions<T = unknown>(argv: yargs.Argv<T>) {
  return argv
    .option('defaultBase', {
      defaultDescription: 'main',
      describe: chalk.dim`Default base to use for new projects`,
      type: 'string',
    })
    .option('skipGit', {
      describe: chalk.dim`Skip initializing a git repository`,
      type: 'boolean',
      default: false,
      alias: 'g',
    })
    .option('commit.name', {
      describe: chalk.dim`Name of the committer`,
      type: 'string',
    })
    .option('commit.email', {
      describe: chalk.dim`E-mail of the committer`,
      type: 'string',
    })
    .option('commit.message', {
      describe: chalk.dim`Commit message`,
      type: 'string',
      default: 'Initial commit',
    });
}

export function withOptions<T>(
  argv: yargs.Argv<T>,
  ...options: ((argv: yargs.Argv<T>) => yargs.Argv<T>)[]
): any {
  // Reversing the options keeps the execution order correct.
  // e.g. [withCI, withGIT] should transform into withGIT(withCI) so withCI resolves first.
  return options.reverse().reduce((argv, option) => option(argv), argv);
}
