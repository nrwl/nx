import {
  chain,
  externalSchematic,
  Rule,
  schematic,
  noop
} from '@angular-devkit/schematics';
import { StorybookConfigureSchema } from './schema';
import { StorybookStoriesSchema } from '../stories/stories';

function generateStories(schema: StorybookConfigureSchema): Rule {
  return (tree, context) => {
    return schematic<StorybookStoriesSchema>('stories', {
      project: schema.name,
      generateCypressSpecs:
        schema.configureCypress && schema.generateCypressSpecs,
      js: schema.js
    });
  };
}

export default function(schema: StorybookConfigureSchema): Rule {
  return chain([
    externalSchematic('@nrwl/storybook', 'configuration', {
      name: schema.name,
      uiFramework: '@storybook/react',
      configureCypress: schema.configureCypress,
      js: schema.js
    }),
    schema.generateStories ? generateStories(schema) : noop()
  ]);
}
