import yargs = require('yargs');
import { terminal } from '@angular-devkit/core';
import { appRootPath } from '../utils/app-root';
import {
  getSchematicCollection,
  readSchematicCollectionsFromNodeModules
} from '../utils/schematic-utils';
import { output } from './output';

export interface YargsListArgs extends yargs.Arguments, ListArgs {}

interface ListArgs {
  schematicCollection?: string;
}

export const list = {
  command: 'list [schematic-collection]',
  describe:
    'Lists the available collections or the schematics within a collection if one is provided as an argument.',
  builder: yargs => yargs.default('schematic-collection', null),
  handler: listHandler
};

/**
 * List available collections or schematics within a specific collection
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
async function listHandler(args: YargsListArgs) {
  if (args.schematicCollection) {
    listSchematicsInCollection(args.schematicCollection);
  } else {
    listCollections();
  }
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
  const schematicCollections = readSchematicCollectionsFromNodeModules(
    appRootPath
  );

  const bodyLines = [];
  schematicCollections.forEach(collection => {
    bodyLines.push(terminal.bold(collection.name));
  });

  output.log({
    title: `Available collections (Use "nx list [schematic-collection]" to find out more) :`,
    bodyLines
  });
}
