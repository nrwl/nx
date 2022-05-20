#!/usr/bin/env node
import * as yargs from 'yargs';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { URL } from 'url';
import { join } from 'path';

import * as version from '@lerna/version/index';
import * as publish from '@lerna/publish/index';

(async () => {
  const options = parseArgs();
  if (!options.local && !options.force) {
    console.log('Authenticating to NPM');
    execSync('npm adduser', {
      stdio: [0, 1, 2],
    });
  }

  if (options.clearLocalRegistry) {
    execSync('yarn local-registry clear');
  }

  const buildCommand = 'yarn build';
  console.log(`> ${buildCommand}`);
  execSync(buildCommand, {
    stdio: [0, 1, 2],
  });

  const versionOptions = {
    bump: options.version ? options.version : undefined,
    conventionalCommits: true,
    conventionalPrerelease: options.tag === 'next',
    preid: options.preid,
    forcePublish: true,
    createRelease: options.tag !== 'next' ? 'github' : undefined,
    noChangelog: options.tag === 'next',
    tagVersionPrefix: '',
    exact: true,
    gitRemote: options.gitRemote,
    gitTagVersion: options.tag !== 'next',
    message: 'chore(misc): publish %v',
    loglevel: options.loglevel ?? 'info',
    yes: false,
  };

  if (options.local) {
    versionOptions.conventionalCommits = false;
    delete versionOptions.createRelease;
    versionOptions.gitTagVersion = false;
    versionOptions.loglevel = options.loglevel ?? 'error';
    versionOptions.yes = true;
    versionOptions.bump = options.version ? options.version : 'minor';
  }

  const lernaJsonPath = join(__dirname, '../lerna.json');
  let originalLernaJson: Buffer;
  let uncommittedFiles: string[];

  try {
    if (options.local || options.tag === 'next') {
      originalLernaJson = readFileSync(lernaJsonPath);
    }
    if (options.local) {
      /**
       * Hide changes from Lerna
       */
      uncommittedFiles = execSync('git diff --name-only --relative HEAD .')
        .toString()
        .split('\n')
        .filter((i) => i.length > 0);
      execSync(
        `git update-index --assume-unchanged ${uncommittedFiles.join(' ')}`
      );
    }

    const publishOptions = {
      gitReset: false,
      distTag: options.tag,
    };

    if (!options.skipPublish) {
      await publish({ ...versionOptions, ...publishOptions });
    } else {
      await version(versionOptions);
      console.warn('Not Publishing because --dryRun was passed');
    }

    if (options.local || options.tag === 'next') {
      writeFileSync(lernaJsonPath, originalLernaJson);
    }
  } finally {
    if (options.local) {
      /**
       * Unhide changes from Lerna
       */
      execSync(
        `git update-index --no-assume-unchanged ${uncommittedFiles.join(' ')}`
      );
    }
  }
})();

function parseArgs() {
  const parsedArgs = yargs
    .scriptName('yarn nx-release')
    .wrap(144)
    .strictOptions()
    .version(false)
    .command(
      '$0 [version]',
      'This script is for publishing Nx both locally and publically'
    )
    .option('skipPublish', {
      type: 'boolean',
      description: 'Skips the actual publishing for testing out versioning',
    })
    .option('clearLocalRegistry', {
      type: 'boolean',
      description:
        'Clear existing versions in the local registry so that you can republish the same version',
      default: true,
    })
    .option('local', {
      type: 'boolean',
      description: 'Publish Nx locally, not to actual NPM',
      alias: 'l',
      default: true,
    })
    .option('force', {
      type: 'boolean',
      description: "Don't use this unless you really know what it does",
      hidden: true,
    })
    .positional('version', {
      type: 'string',
      description:
        'The version to publish. This does not need to be passed and can be inferred.',
    })
    .option('gitRemote', {
      type: 'string',
      description:
        'Alternate git remote name to publish tags to (useful for testing changelog)',
      default: 'origin',
    })
    .option('tag', {
      type: 'string',
      description: 'NPM Tag',
      choices: ['next', 'latest', 'previous'],
    })
    .option('preid', {
      type: 'string',
      description: 'The kind of prerelease tag. (1.0.0-[preid].0)',
      choices: ['alpha', 'beta', 'rc'],
      default: 'beta',
    })
    .option('loglevel', {
      type: 'string',
      description: 'Log Level',
      choices: ['error', 'info', 'debug'],
    })
    .example(
      '$0',
      `By default, this will locally publish a minor version bump as latest. Great for local development. Most developers should only need this.`
    )
    .example(
      '$0 --local false',
      `This will really publish a new beta version to npm as next. The version is inferred by the changes.`
    )
    .example(
      '$0 --local false --tag latest',
      `This will really publish a new stable version to npm as latest, tag, commit, push, and create a release on GitHub.`
    )
    .example(
      '$0 --local false --preid rc',
      `This will really publish a new rc version to npm as next.`
    )
    .group(
      ['local', 'clearLocalRegistry'],
      'Local Publishing Options for most developers'
    )
    .group(
      ['preid', 'tag', 'gitRemote', 'force'],
      'Real Publishing Options for actually publishing to NPM'
    )
    .check((args) => {
      const registry = getRegistry();
      const registryIsLocalhost = registry.hostname === 'localhost';
      if (!args.local) {
        if (!process.env.GH_TOKEN) {
          throw new Error('process.env.GH_TOKEN is not set');
        }
        if (!args.force && registryIsLocalhost) {
          throw new Error(
            'Registry is still set to localhost! Run "yarn local-registry disable" or pass --force'
          );
        }
      } else {
        if (!args.force && !registryIsLocalhost) {
          throw new Error('--local was passed and registry is not localhost');
        }
      }

      return true;
    })
    .parseSync();

  parsedArgs.tag ??= parsedArgs.local ? 'latest' : 'next';

  return parsedArgs;
}

function getRegistry() {
  return new URL(execSync('npm config get registry').toString().trim());
}
