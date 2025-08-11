export const schema = {
  name: 'init',
  factory: './src/generators/init/init#rspackInitGenerator',
  schema: {
    $schema: 'https://json-schema.org/schema',
    cli: 'nx',
    $id: 'Init',
    title: '',
    type: 'object',
    properties: {
      framework: {
        type: 'string',
        description: 'The UI framework used by the project.',
        enum: ['none', 'react', 'web', 'nest'],
        alias: ['uiFramework'],
      },
      style: {
        type: 'string',
        description: 'The style solution to use.',
        enum: ['none', 'css', 'scss', 'less'],
      },
      rootProject: {
        type: 'boolean',
        'x-priority': 'internal',
      },
    },
    required: [],
  },
  description: 'Initialize the `@nx/rspack` plugin.',
  aliases: [],
  hidden: false,
  implementation:
    '/packages/rspack/src/generators/init/init#rspackInitGenerator.ts',
  path: '/nx-api/rspack/src/generators/init/schema.json',
  type: 'generator',
};
