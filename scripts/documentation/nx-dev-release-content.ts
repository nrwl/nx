/**
 * @WhatItDoes: Update nx-dev content for `previous` and `latest` with specific Nx releases.
 */
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { sync as rimraf } from 'rimraf';
import * as shell from 'shelljs';
import * as unZipper from 'unzipper';
import * as yargs from 'yargs';
import {
  readJsonFile,
  writeJsonFile,
} from '../../packages/tao/src/utils/fileutils';

/**
 * Available colours
 */
const { grey, green, red } = chalk;

const argv = yargs
  .command(
    'Usage: $0 --previousRelease [string] --latestRelease [string]',
    'Get Nx releases from Github and update documentation content for nx-dev'
  )
  .example(
    '$0 --previousRelease 11.3.4 --latestRelease 12.3.5',
    'Will update the nx.dev content with these Nx releases specifically. The version selector will show "Previous (11.3.4)" and "Latest (12.3.5)"'
  )
  .example(
    '$0',
    'Will update the nx.dev content with Nx releases for the current releases in the `nx-dev/nx-dev/public/documentation/versions.json`'
  )
  .example(
    '$0 --latestRelease master',
    'Will update the nx.dev content with the latest master as "latest" version'
  )
  .option('previousRelease', {
    alias: 'p',
    demandOption: false,
    type: 'string',
    description:
      'Release version that should match the "latest" release on nx-dev',
  })
  .option('latestRelease', {
    alias: 'l',
    demandOption: false,
    type: 'string',
    description:
      'Release version that should match the "latest" release on nx-dev',
  }).argv;

const directories: {
  documentation: string;
  latest: string;
  previous: string;
  root: string;
  temporary: string;
} = {
  get documentation() {
    return path.join(this.root, 'nx-dev/nx-dev/public/documentation');
  },
  get latest() {
    return path.join(this.documentation, 'latest');
  },
  get previous() {
    return path.join(this.documentation, 'previous');
  },
  root: path.join(__dirname, '../../'),
  get temporary() {
    return path.join(this.root, 'tmp/nx-dev-docs');
  },
};

const releaseVersions: {
  default: (type: 'latest' | 'previous') => string;
  latest: string;
  previous: string;
} = {
  default(type: 'latest' | 'previous'): string {
    return readJsonFile(
      path.join(directories.documentation, 'versions.json')
    ).find((v) => v.id === type)['release'];
  },
  get latest() {
    return (argv.latestRelease as string) || this.default('latest');
  },
  get previous() {
    return (argv.previousRelease as string) || this.default('previous');
  },
};

// Download
function downloadPackage(directoryTarget: string, versionTarget: string): void {
  const url = `https://github.com/nrwl/nx/archive/${versionTarget}.zip`;
  console.log(grey('Downloading Nx release:'), url);
  shell.exec(
    `curl -LkSs ${url} -o ${path.join(
      directoryTarget,
      `${versionTarget}.zip`
    )} `
  );
}

// Extract
function extractPackage(filePath: string, dir: string): Promise<void> {
  console.log(grey(`Extracting ${filePath} package...`));
  return new Promise(function (resolve, reject): any {
    fs.createReadStream(filePath)
      .pipe(unZipper.Extract({ path: dir }))
      .on('error', (error: string) => reject(error))
      .on('close', () => resolve(0));
  }).then(() =>
    console.log(green(`Package ${filePath} extracted successfully`))
  );
}

// Copy files
function copyAssets(sourcePath: string, destinationPath: string): void {
  console.log(
    grey(`Copying assets: from "${sourcePath}" to "${destinationPath}"`)
  );
  shell.cp('-R', sourcePath, destinationPath);
}

function updateJsonVersion(
  jsonPath: string,
  version: { id: 'latest' | 'previous'; release: string }
): void {
  console.log(grey(`Updating ${jsonPath}`));
  const json: {
    name: string;
    id: string;
    release: string;
    path: string;
    default: boolean;
  }[] = readJsonFile(jsonPath);
  const targetIndex = json.findIndex((v) => v.id === version.id);
  json[targetIndex].name = json[targetIndex].name.replace(
    json[targetIndex]['release'],
    version.release
  );
  json[targetIndex].release = json[targetIndex].release.replace(
    json[targetIndex]['release'],
    version.release
  );

  writeJsonFile(jsonPath, json);
  console.log(
    green(`${jsonPath}\n Updated for ${version.id} with ${version.release}`)
  );
}

// MAIN
function main(versions: { latest: string; previous: string }): void {
  if (
    !versions ||
    !Object.prototype.hasOwnProperty.call(versions, 'latest') ||
    !Object.prototype.hasOwnProperty.call(versions, 'previous')
  ) {
    throw new Error(
      'Object is malformed: You have to pass an object of the following type: `{ latest: string; previous: string }`'
    );
  }

  // Init
  rimraf(directories.temporary);
  rimraf(directories.latest);
  rimraf(directories.previous);
  shell.mkdir('-p', directories.temporary);

  let assetsFolder: Promise<string>;

  // Downloads
  downloadPackage(directories.temporary, versions.latest);
  downloadPackage(directories.temporary, versions.previous);
  // Extract
  Promise.all([
    extractPackage(
      path.join(directories.temporary, `${versions.latest}.zip`),
      directories.temporary
    ),
    extractPackage(
      path.join(directories.temporary, `${versions.previous}.zip`),
      directories.temporary
    ),
  ])
    .then(() => {
      // Copy assets
      copyAssets(
        path.join(directories.temporary, `nx-${versions.latest}/docs`),
        directories.latest
      );
      copyAssets(
        path.join(directories.temporary, `nx-${versions.previous}/docs`),
        directories.previous
      );

      // Update `versions.json`
      updateJsonVersion(path.join(directories.documentation, 'versions.json'), {
        id: 'latest',
        release: versions.latest,
      });
      updateJsonVersion(path.join(directories.documentation, 'versions.json'), {
        id: 'previous',
        release: versions.previous,
      });
    })
    .then(
      () => rimraf(directories.temporary) // Cleaning up
    )
    .catch((error): void => console.log(red(`Something went wrong!\n`), error))
    .finally(() => console.log(green('Generation done ✨')));
}

main(releaseVersions);
