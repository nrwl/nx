import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';
import { StorybookConfigureSchema } from './schema';

export default function(schema: StorybookConfigureSchema): Rule {
  return chain([
    externalSchematic('@nrwl/storybook', 'configuration', {
      name: schema.name,
      uiFramework: '@storybook/react',
      configureCypress: schema.configureCypress
    })
  ]);
}
