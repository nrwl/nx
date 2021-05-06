import { StorybookMigrateDefault5to6Schema } from './schema';

import { convertNxGenerator, Tree } from '@nrwl/devkit';
import { migrateDefaultsGenerator } from '@nrwl/storybook';

export function storybookMigration5to6Generator(
  host: Tree,
  schema: StorybookMigrateDefault5to6Schema
) {
  return migrateDefaultsGenerator(host, {
    name: schema.name,
    all: schema.all,
    keepOld: schema.keepOld,
  });
}

export default storybookMigration5to6Generator;
export const storybookMigration5to6Schematic = convertNxGenerator(
  storybookMigration5to6Generator
);
