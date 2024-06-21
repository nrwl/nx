#!/usr/bin/env node
import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import * as chalk from 'chalk';
import { execSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';
import { isRelativeVersionKeyword } from 'nx/src/command-line/release/utils/semver';
import { ReleaseType, inc, major, parse } from 'semver';
import * as yargs from 'yargs';

const LARGE_BUFFER = 1024 * 1000000;

// DO NOT MODIFY, even for testing. This only gates releases to latest.
const VALID_AUTHORS_FOR_LATEST = [
  'jaysoo',
  'JamesHenry',
  'FrozenPandaz',
  'vsavkin',
];

(async () => {
  const options = parseArgs();
  // Perform minimal logging by default
  let isVerboseLogging = process.env.NX_VERBOSE_LOGGING === 'true';

  if (options.clearLocalRegistry) {
    rmSync(join(__dirname, '../build/local-registry/storage'), {
      recursive: true,
      force: true,
    });
  }

  const buildCommand = 'pnpm build';
  console.log(`> ${buildCommand}`);
  execSync(buildCommand, {
    stdio: [0, 1, 2],
    maxBuffer: LARGE_BUFFER,
  });

  // Ensure all the native-packages directories are available at the top level of the build directory, enabling consistent packageRoot structure
  execSync(`pnpm nx copy-native-package-directories nx`, {
    stdio: isVerboseLogging ? [0, 1, 2] : 'ignore',
    maxBuffer: LARGE_BUFFER,
  });

  // Expected to run as part of the Github `publish` workflow
  if (!options.local && process.env.NODE_AUTH_TOKEN) {
    // Delete all .node files that were built during the previous steps
    // Always run before the artifacts step because we still need the .node files for native-packages
    execSync('find ./build -name "*.node" -delete', {
      stdio: [0, 1, 2],
      maxBuffer: LARGE_BUFFER,
    });

    execSync('pnpm nx run-many --target=artifacts', {
      stdio: [0, 1, 2],
      maxBuffer: LARGE_BUFFER,
    });
  }

  const runNxReleaseVersion = () => {
    let versionCommand = `pnpm nx release version${
      options.version ? ` --specifier ${options.version}` : ''
    }`;
    if (options.dryRun) {
      versionCommand += ' --dry-run';
    }
    if (isVerboseLogging) {
      versionCommand += ' --verbose';
    }
    console.log(`> ${versionCommand}`);
    execSync(versionCommand, {
      stdio: isVerboseLogging ? [0, 1, 2] : 'ignore',
      maxBuffer: LARGE_BUFFER,
    });
  };

  // Intended for creating a github release which triggers the publishing workflow
  if (!options.local && !process.env.NODE_AUTH_TOKEN) {
    // For this important use-case it makes sense to always have full logs
    isVerboseLogging = true;

    execSync('git status --ahead-behind');

    if (isRelativeVersionKeyword(options.version)) {
      throw new Error(
        'When creating actual releases, you must use an exact semver version'
      );
    }

    runNxReleaseVersion();

    execSync(`pnpm nx run-many -t add-extra-dependencies --parallel 8`, {
      stdio: isVerboseLogging ? [0, 1, 2] : 'ignore',
      maxBuffer: LARGE_BUFFER,
    });

    let changelogCommand = `pnpm nx release changelog ${options.version} --interactive workspace`;
    if (options.from) {
      changelogCommand += ` --from ${options.from}`;
    }
    if (options.gitRemote) {
      changelogCommand += ` --git-remote ${options.gitRemote}`;
    }
    if (options.dryRun) {
      changelogCommand += ' --dry-run';
    }
    if (isVerboseLogging) {
      changelogCommand += ' --verbose';
    }
    console.log(`> ${changelogCommand}`);
    execSync(changelogCommand, {
      stdio: isVerboseLogging ? [0, 1, 2] : 'ignore',
      maxBuffer: LARGE_BUFFER,
    });

    console.log(
      'Check github: https://github.com/nrwl/nx/actions/workflows/publish.yml'
    );
    process.exit(0);
  }

  runNxReleaseVersion();

  execSync(`pnpm nx run-many -t add-extra-dependencies --parallel 8`, {
    stdio: isVerboseLogging ? [0, 1, 2] : 'ignore',
    maxBuffer: LARGE_BUFFER,
  });

  const distTag = determineDistTag(options.version);

  // If publishing locally, force all projects to not be private first
  if (options.local) {
    console.log(
      chalk.dim`\n  Publishing locally, so setting all packages with existing nx-release-publish targets to not be private. If you have created a new private package and you want it to be published, you will need to manually configure the "nx-release-publish" target using executor "@nx/js:release-publish"`
    );
    const projectGraph = await createProjectGraphAsync();
    for (const proj of Object.values(projectGraph.nodes)) {
      if (proj.data.targets?.['nx-release-publish']) {
        const packageJsonPath = join(
          workspaceRoot,
          proj.data.targets?.['nx-release-publish']?.options.packageRoot,
          'package.json'
        );
        try {
          const packageJson = require(packageJsonPath);
          if (packageJson.private) {
            console.log(
              '- Publishing private package locally:',
              packageJson.name
            );
            writeFileSync(
              packageJsonPath,
              JSON.stringify({ ...packageJson, private: false })
            );
          }
        } catch {}
      }
    }
  }

  if (!options.local && (!distTag || distTag === 'latest')) {
    // We are only expecting non-local latest releases to be performed within publish.yml on GitHub
    const author = process.env.GITHUB_ACTOR ?? '';
    if (!VALID_AUTHORS_FOR_LATEST.includes(author)) {
      throw new Error(
        `The GitHub user "${author}" is not allowed to publish to "latest". Please request one of the following users to carry out the release: ${VALID_AUTHORS_FOR_LATEST.join(
          ', '
        )}`
      );
    }
  }

  // Run with dynamic output-style so that we have more minimal logs by default but still always see errors
  let publishCommand = `pnpm nx release publish --registry=${getRegistry()} --tag=${distTag} --output-style=dynamic --parallel=8`;
  if (options.dryRun) {
    publishCommand += ' --dry-run';
  }
  console.log(`\n> ${publishCommand}`);
  execSync(publishCommand, {
    stdio: [0, 1, 2],
    maxBuffer: LARGE_BUFFER,
  });

  if (!options.dryRun) {
    let version;
    if (['minor', 'major', 'patch'].includes(options.version)) {
      version = execSync(`npm view nx@${distTag} version`).toString().trim();
    } else {
      version = options.version;
    }

    console.log(chalk.green` > Published version: ` + version);
    console.log(chalk.dim`   Use: npx create-nx-workspace@${version}\n`);
  }

  process.exit(0);
})();

function parseArgs() {
  const registry = getRegistry();
  const registryIsLocalhost = registry.hostname === 'localhost';

  const parsedArgs = yargs
    .scriptName('pnpm nx-release')
    .wrap(144)
    .strictOptions()
    .version(false)
    .command(
      '$0 [version]',
      'This script is for publishing Nx both locally and publically'
    )
    .option('dryRun', {
      type: 'boolean',
      description: 'Dry-run flag to be passed to all `nx release` commands',
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
    .option('from', {
      type: 'string',
      description:
        'Git ref to pass to `nx release changelog`. Not applicable for local publishing or e2e tests.',
    })
    .positional('version', {
      type: 'string',
      description:
        'The version to publish. This does not need to be passed and can be inferred.',
      default: 'minor',
      coerce: (version: string) => {
        const isGithubActions = !!process.env.GITHUB_ACTIONS;
        if (
          isGithubActions &&
          !registryIsLocalhost &&
          isRelativeVersionKeyword(version)
        ) {
          // Print error rather than throw to avoid yargs noise in this specifically handled case
          console.error(
            'Error: The release script was triggered in a GitHub Actions workflow, to a non-local registry, but a relative version keyword was provided. This is an unexpected combination.'
          );
          process.exit(1);
        }

        if (version !== 'canary') {
          return version;
        }
        /**
         * Handle the special case of `canary`
         */

        const currentLatestVersion = execSync('npm view nx@latest version')
          .toString()
          .trim();
        const currentNextVersion = execSync('npm view nx@next version')
          .toString()
          .trim();

        let canaryBaseVersion: string | null = null;

        // If the latest and next are not on the same major version, then we need to publish a canary version of the next major
        if (major(currentLatestVersion) !== major(currentNextVersion)) {
          canaryBaseVersion = `${major(currentNextVersion)}.0.0`;
        } else {
          // Determine next minor version above the currentLatestVersion
          const nextMinorRelease = inc(
            currentLatestVersion,
            'minor',
            undefined
          );
          canaryBaseVersion = nextMinorRelease;
        }

        if (!canaryBaseVersion) {
          throw new Error(`Unable to determine a base for the canary version.`);
        }

        // Create YYYYMMDD string
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const day = String(date.getDate()).padStart(2, '0');
        const YYYYMMDD = `${year}${month}${day}`;

        // Get the current short git sha
        const gitSha = execSync('git rev-parse --short HEAD').toString().trim();

        const canaryVersion = `${canaryBaseVersion}-canary.${YYYYMMDD}-${gitSha}`;

        console.log(`\nDerived canary version dynamically`, {
          currentLatestVersion,
          currentNextVersion,
          canaryVersion,
        });

        return canaryVersion;
      },
    })
    .option('gitRemote', {
      type: 'string',
      description:
        'Alternate git remote name to publish tags to (useful for testing changelog)',
      default: 'origin',
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
    .demandOption('version')
    .check((args) => {
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

  return parsedArgs;
}

function getRegistry() {
  return new URL(execSync('npm config get registry').toString().trim());
}

function determineDistTag(
  newVersion: string
): 'latest' | 'next' | 'previous' | 'canary' | 'pull-request' {
  // Special case of canary
  if (newVersion.includes('canary')) {
    return 'canary';
  }

  // Special case of PR release
  if (newVersion.startsWith('0.0.0-pr-')) {
    return 'pull-request';
  }

  // For a relative version keyword, it cannot be previous
  if (isRelativeVersionKeyword(newVersion)) {
    const prereleaseKeywords: ReleaseType[] = [
      'premajor',
      'preminor',
      'prepatch',
      'prerelease',
    ];
    return prereleaseKeywords.includes(newVersion) ? 'next' : 'latest';
  }

  const parsedGivenVersion = parse(newVersion);
  if (!parsedGivenVersion) {
    throw new Error(
      `Unable to parse the given version: "${newVersion}". Is it valid semver?`
    );
  }

  const currentLatestVersion = execSync('npm view nx version')
    .toString()
    .trim();
  const parsedCurrentLatestVersion = parse(currentLatestVersion);
  if (!parsedCurrentLatestVersion) {
    throw new Error(
      `The current version resolved from the npm registry could not be parsed (resolved "${currentLatestVersion}")`
    );
  }

  const distTag =
    parsedGivenVersion.prerelease.length > 0
      ? 'next'
      : parsedGivenVersion.major < parsedCurrentLatestVersion.major
      ? 'previous'
      : 'latest';

  return distTag;
}
