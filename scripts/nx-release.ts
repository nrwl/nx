#!/usr/bin/env node
import * as yargs from 'yargs';
import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { URL } from 'url';
import { join } from 'path';

import { parse } from 'semver';

const version = require('lerna/commands/version');
const publish = require('lerna/commands/publish');

const lernaJsonPath = join(__dirname, '../lerna.json');
const originalLernaJson = readFileSync(lernaJsonPath);

function hideFromGitIndex(uncommittedFiles: string[]) {
  execSync(`git update-index --assume-unchanged ${uncommittedFiles.join(' ')}`);

  return () =>
    execSync(
      `git update-index --no-assume-unchanged ${uncommittedFiles.join(' ')}`
    );
}

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
    parsedVersion?.prerelease.length > 0
      ? 'next'
      : parsedVersion?.major < parsedCurrentLatestVersion.major
      ? 'previous'
      : 'latest';

  const buildCommand = 'pnpm build';
  console.log(`> ${buildCommand}`);
  execSync(buildCommand, {
    stdio: [0, 1, 2],
  });

  if (options.local) {
    updateLernaJsonVersion(currentLatestVersion);
  }

  if (options.local) {
    // Force all projects to be not private
    const projects = JSON.parse(
      execSync('npx lerna list --json --all').toString()
    );
    for (const proj of projects) {
      if (proj.private) {
        console.log('Publishing private package locally:', proj.name);
        const packageJsonPath = join(proj.location, 'package.json');
        const original = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        writeFileSync(
          packageJsonPath,
          JSON.stringify({ ...original, private: false })
        );
      }
    }
  }

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
    gitTagVersion: !process.env.NPM_TOKEN,
    message: 'chore(misc): publish %v',
    loglevel: options.loglevel ?? 'info',
    yes: !!process.env.NPM_TOKEN,
  };

  if (options.local) {
    versionOptions.conventionalCommits = false;
    delete versionOptions.createRelease;
    versionOptions.gitTagVersion = false;
    versionOptions.loglevel = options.loglevel ?? 'error';
    versionOptions.yes = true;
    versionOptions.bump = options.version ? options.version : 'minor';
  }

  if (options.local) {
    /**
     * Hide changes from Lerna
     */
    const uncommittedFiles = execSync('git diff --name-only --relative HEAD .')
      .toString()
      .split('\n')
      .filter((i) => i.length > 0)
      .filter((f) => existsSync(f));
    const unhideFromGitIndex = hideFromGitIndex(uncommittedFiles);

    process.on('exit', unhideFromGitIndex);
    process.on('SIGTERM', unhideFromGitIndex);
    process.on('SIGINT', unhideFromGitIndex);
  }

  const publishOptions: Record<string, boolean | string | undefined> = {
    gitReset: false,
    distTag: distTag,
  };

  if (!options.local && !process.env.NPM_TOKEN) {
    execSync('git status --ahead-behind');

    await version(versionOptions);
    console.log(
      'Check github: https://github.com/nrwl/nx/actions/workflows/publish.yml'
    );
  } else if (!options.skipPublish) {
    await publish({ ...versionOptions, ...publishOptions });
  } else {
    await version(versionOptions);
    console.warn('Not Publishing because --dryRun was passed');
  }

  if (options.local) {
    restoreOriginalLernaJson();
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

function updateLernaJsonVersion(version: string) {
  const json = JSON.parse(readFileSync(lernaJsonPath).toString());

  json.version = version;

  writeFileSync(lernaJsonPath, JSON.stringify(json));
}

function restoreOriginalLernaJson() {
  writeFileSync(lernaJsonPath, originalLernaJson);
}

function getRegistry() {
  return new URL(execSync('npm config get registry').toString().trim());
}
