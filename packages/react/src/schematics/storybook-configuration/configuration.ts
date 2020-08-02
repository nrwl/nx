import {
  chain,
  externalSchematic,
  Rule,
  schematic,
  noop,
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { Schema as StorybookStoriesSchema } from '../stories/schema';

function generateStories(schema: Schema): Rule {
  return (tree, context) => {
    return schematic<StorybookStoriesSchema>('stories', {
      project: schema.name,
      generateCypressSpecs:
        schema.configureCypress && schema.generateCypressSpecs,
      js: schema.js,
    });
  };
}

export default function (schema: Schema): Rule {
  return chain([
    externalSchematic('@nrwl/storybook', 'configuration', {
      name: schema.name,
      uiFramework: '@storybook/react',
      configureCypress: schema.configureCypress,
      js: schema.js,
      linter: schema.linter,
    }),
    schema.generateStories ? generateStories(schema) : noop(),
  ]);
}
