import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';
import { StorybookMigrateDefault5to6Schema } from './schema';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

export default function (schema: StorybookMigrateDefault5to6Schema): Rule {
  return chain([
    externalSchematic('@nrwl/storybook', 'migrate-defaults-5-to-6', {
      name: schema.name,
      all: schema.all,
      keepOld: schema.keepOld,
    }),
  ]);
}

export const storybookMigration5to6Generator = wrapAngularDevkitSchematic(
  '@nrwl/angular',
  'storybook-migrate-defaults-5-to-6'
);
