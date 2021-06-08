import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

export default function (): Rule {
  return chain([
    externalSchematic('@nrwl/storybook', 'migrate-stories-to-6-2', {}),
  ]);
}

export const storybookMigration5to6Generator = wrapAngularDevkitSchematic(
  '@nrwl/angular',
  'storybook-migrate-stories-to-6-2'
);
