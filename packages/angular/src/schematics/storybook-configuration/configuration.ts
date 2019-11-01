import {
  chain,
  externalSchematic,
  Rule,
  schematic
} from '@angular-devkit/schematics';
import { StorybookStoriesSchema } from '../stories/stories';
import { StorybookConfigureSchema } from './schema';

export default function(schema: StorybookConfigureSchema): Rule {
  return chain([
    externalSchematic('@nrwl/storybook', 'configuration', {
      name: schema.name,
      uiFramework: '@storybook/angular',
      configureCypress: schema.configureCypress
    }),
    generateStories(schema)
  ]);
}

function generateStories(schema: StorybookConfigureSchema): Rule {
  return (tree, context) => {
    return schematic<StorybookStoriesSchema>('stories', {
      name: schema.name,
      generateCypressSpecs:
        schema.configureCypress && schema.generateCypressSpecs
    });
  };
}
