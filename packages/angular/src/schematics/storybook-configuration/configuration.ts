import {
  chain,
  externalSchematic,
  Rule,
  schematic,
  noop,
} from '@angular-devkit/schematics';
import { StorybookStoriesSchema } from '../stories/stories';
import { StorybookConfigureSchema } from './schema';

export default function (schema: StorybookConfigureSchema): Rule {
  if (schema.generateCypressSpecs && !schema.generateStories) {
    throw new Error(
      'Cannot set generateCypressSpecs to true when generateStories is set to false.'
    );
  }

  return chain([
    externalSchematic('@nrwl/storybook', 'configuration', {
      name: schema.name,
      uiFramework: '@storybook/angular',
      configureCypress: schema.configureCypress,
      linter: schema.linter,
    }),
    schema.generateStories ? generateStories(schema) : noop(),
  ]);
}

function generateStories(schema: StorybookConfigureSchema): Rule {
  return (tree, context) => {
    return schematic<StorybookStoriesSchema>('stories', {
      name: schema.name,
      generateCypressSpecs:
        schema.configureCypress && schema.generateCypressSpecs,
    });
  };
}
