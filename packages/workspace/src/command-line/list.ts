import yargs = require('yargs');
import { terminal } from '@angular-devkit/core';
import { appRootPath } from '../utils/app-root';
import { Collection, recommendedCollectionMap } from '../utils/collections';
import { detectPackageManager } from '../utils/detect-package-manager';
import {
  getSchematicCollection,
  getSchematicCollectionVersion,
  readSchematicCollectionsFromNodeModules
} from '../utils/schematic-utils';
import { output } from './output';

export interface YargsListArgs extends yargs.Arguments, ListArgs {}

interface ListArgs {
  schematicCollection?: string;
}

export const list = {
  command: 'list [schematic-collection] [--recommended || -r]',
  describe:
    'Lists the installed collections, schematics within an installed collection or recommended collections.',
  builder: (yargs: yargs.Argv) =>
    yargs
      .positional('schematic-collection', {
        default: null,
        description: 'The name of an installed schematic collection to query'
      })
      .option('recommended', {
        default: false,
        alias: 'r',
        description:
          'Analyse the current workspace to recomend collections to install'
      }),
  handler: listHandler
};

/**
 * List available collections or schematics within a specific collection
 * Also list recommended collections when the `--recommended` flag is used
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
async function listHandler(args: YargsListArgs) {
  if (args.recommended) {
    listRecommendedCollections();
  } else if (args.schematicCollection) {
    listSchematicsInCollection(args.schematicCollection);
  } else {
    listCollections();
  }
}

function listRecommendedCollections() {
  let packageManager = detectPackageManager();
  let packageManagerInstallCommand = 'npm install --save-dev';
  switch (packageManager) {
    case 'yarn':
      packageManagerInstallCommand = 'yarn add --dev';
      break;

    case 'pnpm':
      packageManagerInstallCommand = 'pnpm install --save-dev';
      break;
  }

  const packageJson = require(appRootPath + '/package.json');
  const packageList = [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {})
  ];

  const installedCollections = readSchematicCollectionsFromNodeModules(
    appRootPath
  );

  const recommend: string[] = [];
  const consider: string[] = [];
  const dependencies: string[] = [];

  Object.keys(recommendedCollectionMap).forEach((k: Collection) => {
    const info = recommendedCollectionMap[k];

    const isInstalled = installedCollections.some(c => c.name === k);
    const message = `${terminal.bold(k)} ${
      isInstalled ? terminal.green('INSTALLED') : ''
    } : ${recommendedCollectionMap[k].description}`;

    if (
      (info.for && info.for.some((p: string) => packageList.includes(p))) ||
      dependencies.includes(k)
    ) {
      recommend.push(message);
      if (info.dependencies) {
        dependencies.push(...info.dependencies);
      }
    } else {
      consider.push(message);
    }
  });

  if (recommend.length > 0) {
    output.log({
      title: `For your current workspace the following collections are recommended :`,
      bodyLines: recommend
    });

    if (consider.length > 0) {
      output.note({
        title: `You may also consider the following collections :`,
        bodyLines: consider
      });
    }
  } else {
    output.log({
      title: `The following collections are available to install :`,
      bodyLines: consider
    });
  }

  let workspaceVersion = 'latest';
  if (installedCollections.some(x => x.name === '@nrwl/workspace')) {
    workspaceVersion = getSchematicCollectionVersion(
      appRootPath,
      '@nrwl/workspace'
    );
  }

  output.note({
    title: `Use "${packageManagerInstallCommand} [schematic-collection]@${workspaceVersion}" to add new capabilities`
  });
}

function listSchematicsInCollection(collectionName) {
  const collection = getSchematicCollection(appRootPath, collectionName);

  if (!collection) {
    output.error({
      title: `Could not find collection ${collectionName}`
    });
    return;
  }

  const bodyLines = [];
  for (const name in collection.schematics) {
    bodyLines.push(
      `${terminal.bold(name)} : ${collection.schematics[name].description}`
    );
  }

  output.log({
    title: `Available schematics in ${collectionName} :`,
    bodyLines
  });
}

function listCollections() {
  const installedCollections = readSchematicCollectionsFromNodeModules(
    appRootPath
  );

  const bodyLines = [];
  installedCollections.forEach(collection => {
    bodyLines.push(terminal.bold(collection.name));
  });

  output.log({
    title: `Installed collections :`,
    bodyLines
  });

  output.note({
    title: `Use "nx list [schematic-collection]" to find out more`
  });
}
