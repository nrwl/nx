import { styleText } from 'node:util';
import yargs = require('yargs');
import { NxCloudChoices, messages } from '../utils/nx/ab-testing';
import { packageManagerList } from '../utils/package-manager';

export function withNxCloud<T = unknown>(argv: yargs.Argv<T>) {
  const { message } = messages.getPrompt('setupCI');

  const result = argv.option('nxCloud', {
    alias: 'ci',
    describe: styleText('dim', message),
    choices: NxCloudChoices,
    type: 'string',
  });
  return result;
}

export function withUseGitHub<T = unknown>(argv: yargs.Argv<T>) {
  return argv.option('useGitHub', {
    describe: styleText(
      'dim',
      'Will you be using GitHub as your git hosting provider?'
    ),
    type: 'boolean',
    default: false,
  });
}

export function withAllPrompts<T = unknown>(argv: yargs.Argv<T>) {
  return argv.option('allPrompts', {
    alias: 'a',
    describe: styleText('dim', 'Show all prompts.'),
    type: 'boolean',
    default: false,
  });
}

export function withPackageManager<T = unknown>(argv: yargs.Argv<T>) {
  return argv.option('packageManager', {
    alias: 'pm',
    describe: styleText('dim', 'Package manager to use.'),
    choices: [...packageManagerList].sort(),
    defaultDescription: 'npm',
    type: 'string',
  });
}

export function withGitOptions<T = unknown>(argv: yargs.Argv<T>) {
  return argv
    .option('defaultBase', {
      defaultDescription: 'main',
      describe: styleText('dim', 'Default base to use for new projects.'),
      type: 'string',
    })
    .option('skipGit', {
      describe: styleText('dim', 'Skip initializing a git repository.'),
      type: 'boolean',
      default: false,
      alias: 'g',
    })
    .option('skipGitHubPush', {
      describe: styleText('dim', 'Skip pushing to GitHub via gh CLI.'),
      type: 'boolean',
      default: false,
    })
    .option('verbose', {
      describe: styleText('dim', 'Enable verbose logging.'),
      type: 'boolean',
      default: false,
      alias: 'v',
    })
    .option('commit.name', {
      describe: styleText('dim', 'Name of the committer.'),
      type: 'string',
    })
    .option('commit.email', {
      describe: styleText('dim', 'E-mail of the committer.'),
      type: 'string',
    })
    .option('commit.message', {
      describe: styleText('dim', 'Commit message.'),
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
