#!/usr/bin/env node
import { execSync } from 'child_process';
import { rmSync } from 'fs';
import { join } from 'path';
import { parse } from 'semver';
import { URL } from 'url';
import * as yargs from 'yargs';

const version = require('lerna/commands/version');
const publish = require('lerna/commands/publish');

(async () => {
  const options = parseArgs();

  if (options.clearLocalRegistry) {
    rmSync(join(__dirname, '../build/local-registry/storage'), {
      recursive: true,
      force: true,
    });
  }

  const currentLatestVersion = execSync('npm view nx version')
    .toString()
    .trim();

  const parsedVersion = parse(options.version);
  const parsedCurrentLatestVersion = parse(currentLatestVersion);

  const distTag =
    parsedVersion?.prerelease.length! > 0
      ? 'next'
      : parsedVersion?.major! < parsedCurrentLatestVersion?.major!
      ? 'previous'
      : 'latest';

  const buildCommand = 'pnpm build';
  console.log(`> ${buildCommand}`);
  execSync(buildCommand, {
    stdio: [0, 1, 2],
  });

  if (!options.local && process.env.NPM_TOKEN) {
    // Delete all .node files that were built during the previous steps
    // Always run before the artifacts step because we still need the .node files for native-packages
    execSync('find ./build -name "*.node" -delete', {
      stdio: [0, 1, 2],
    });

    execSync('npx nx run-many --target=artifacts', {
      stdio: [0, 1, 2],
    });
  }

  const versionOptions = {
    bump: options.version ? options.version : undefined,
    conventionalCommits: true,
    conventionalPrerelease: options.tag === 'next',
    preid: options.preid,
    forcePublish: true,
    createRelease: 'github',
    tagVersionPrefix: '',
    exact: true,
    gitRemote: options.gitRemote,
    // tag the commit only if run locally and not in CI.
    // if run during CI, we are publishing instead.
    gitTagVersion: !process.env.NPM_TOKEN,
    message: 'chore(misc): publish %v',
    loglevel: options.loglevel ?? 'info',
    distTag: distTag,
    yes: !!process.env.NPM_TOKEN,
    // set granularPathspec so that the version command only resets
    // changes it made and NOT uncommitted working changes in the repo
    granularPathspec: true,
  };

  if (options.local) {
    versionOptions.conventionalCommits = false;
    // @ts-ignore
    delete versionOptions.createRelease;
    versionOptions.gitTagVersion = false;
    versionOptions.loglevel = options.loglevel ?? 'error';
    versionOptions.yes = true;
    versionOptions.bump = options.version ? options.version : 'minor';
  }

  const publishOptions: Record<string, boolean | string | undefined> = {
    includePrivate: options.local ? '*' : false,
  };

  // manual release
  if (!options.local && !process.env.NPM_TOKEN) {
    execSync('git status --ahead-behind');
    await version(versionOptions);
    console.log(
      'Check github: https://github.com/nrwl/nx/actions/workflows/publish.yml'
    );
    // local publish for testing
  } else if (!options.skipPublish) {
    await publish({
      ...versionOptions,
      ...publishOptions,
    });
    // testing versioning flow
  } else {
    await version(versionOptions);
    console.warn('Not Publishing because --skipPublish was passed');
  }
})();

function parseArgs() {
  const parsedArgs = yargs
    .scriptName('pnpm nx-release')
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
      '$0 --local false 2.3.4-beta.0',
      `This will really publish a new version to npm as next.`
    )
    .example(
      '$0 --local false 2.3.4',
      `Given the current latest major version on npm is 2, this will really publish a new version to npm as latest.`
    )
    .example(
      '$0 --local false 1.3.4-beta.0',
      `Given the current latest major version on npm is 2, this will really publish a new version to npm as previous.`
    )
    .group(
      ['local', 'clearLocalRegistry'],
      'Local Publishing Options for most developers'
    )
    .group(
      ['gitRemote', 'force'],
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
            'Registry is still set to localhost! Run "pnpm local-registry disable" or pass --force'
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
