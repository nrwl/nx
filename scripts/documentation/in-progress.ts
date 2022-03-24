import {
  htmlSelectorFormat,
  pathFormat,
} from '@angular-devkit/schematics/src/formats';
import { readJsonSync } from 'fs-extra';
import { parseJsonSchemaToOptions } from './json-parser';
import { createSchemaFlattener } from './schema-flattener';

const flattener = createSchemaFlattener([pathFormat, htmlSelectorFormat]);

const builder = {
  name: 'run-commands',
  collectionName: '@nrwl/workspace',
  implementation: './src/executors/run-commands/run-commands.impl',
  schema: './src/executors/run-commands/schema.json',
  description: 'Run any custom commands with Nx',
  rawSchema: readJsonSync(
    '/Users/ben/Documents/projects/nx/packages/workspace/src/executors/run-commands/schema.json'
  ),
  examplesFileFullPath:
    '/Users/ben/Documents/projects/nx/packages/workspace/docs/run-commands-examples.md',
};

parseJsonSchemaToOptions(flattener, builder.rawSchema)
  .then((options) => ({
    ...builder,
    options,
  }))
  .then((data) =>
    console.log(
      '==========================================================================================\n',
      data
    )
  );
