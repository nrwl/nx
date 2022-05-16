/*
 * Lookup for all the schema.json and add create a list with their path and related package information
 * */
import * as chalk from 'chalk';
import { readJsonSync, writeJSONSync } from 'fs-extra';
import { join, resolve } from 'path';
import {
  getSchemaFromReference,
  InternalLookup,
} from '../../../nx-dev/data-access-packages/src/lib/lookup';
import { NxSchema } from '../../../nx-dev/models-package/src/lib/package.models';
import { generateJsonFile } from '../utils';
import { getPackageMetadataList } from './package-metadata';
import { schemaResolver } from './schema.resolver';

function processSchemaData(data: NxSchema, path: string): NxSchema {
  const lookup = new InternalLookup(data);
  const schema = getSchemaFromReference('#', lookup) as NxSchema;

  if (schema === undefined)
    throw new Error('ERROR: Could not look up the schema at: ' + data.title);

  if (typeof schema === 'boolean')
    throw new Error('ERROR: Boolean schema not supported.');

  const resolver = schemaResolver(schema, lookup, path);
  resolver.resolveReferences();
  resolver.resolveExamplesFile();
  return resolver.getSchema();
}

function pathResolver(root: string): (path: string) => string {
  return (path) => join(root, path.replace('schema.json', ''));
}

export function generatePackageSchemas(): void {
  console.log(`${chalk.blue('i')} Generating Package Schemas`);
  const absoluteRoot = resolve(join(__dirname, '../../../'));
  const packages = getPackageMetadataList(absoluteRoot, 'packages', 'docs').map(
    (packageMetadata) => {
      const getCurrentSchemaPath = pathResolver(absoluteRoot);
      if (!!packageMetadata.executors.length) {
        packageMetadata.executors = packageMetadata.executors.map((item) => ({
          ...item,
          schema: processSchemaData(
            item.schema,
            getCurrentSchemaPath(item['path'].replace('schema.json', ''))
          ),
        }));
      }
      if (!!packageMetadata.generators.length) {
        packageMetadata.generators = packageMetadata.generators.map((item) => ({
          ...item,
          schema: processSchemaData(
            item.schema,
            getCurrentSchemaPath(item['path'].replace('schema.json', ''))
          ),
        }));
      }
      return packageMetadata;
    }
  );

  const outputPath: string = join(absoluteRoot, 'docs');

  /*
   * Creates packages.json file containing the list of the packages created with their path.
   */
  const packageList = packages.map((p) => ({
    name: p.name,
    path: join('generated', 'packages', p.name + '.json'),
    schemas: {
      executors: p.executors.map((s) => s.name),
      generators: p.generators.map((s) => s.name),
    },
  }));
  generateJsonFile(join(outputPath, 'packages.json'), packageList);

  /**
   * Generates each package metadata in an `/packages` sub-folder.
   */
  packages.forEach(
    (p): Promise<void> =>
      generateJsonFile(
        join(outputPath, 'generated', 'packages', p.name + '.json'),
        p
      )
  );
}
