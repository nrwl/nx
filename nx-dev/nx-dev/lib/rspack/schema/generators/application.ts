export const schema = {
  name: 'application',
  factory: './src/generators/application/application#applicationGenerator',
  schema: {
    $schema: 'http://json-schema.org/schema',
    cli: 'nx',
    $id: 'Application',
    title: 'Application generator for React + rspack',
    type: 'object',
    examples: [
      {
        command: 'nx g app myapp --directory=myorg',
        description: 'Generate `apps/myorg/myapp` and `apps/myorg/myapp-e2e`',
      },
    ],
    properties: {
      name: {
        description: 'The name of the application.',
        type: 'string',
        $default: {
          $source: 'argv',
          index: 0,
        },
        'x-prompt': 'What name would you like to use for the application?',
        pattern: '^[a-zA-Z].*$',
        'x-priority': 'important',
      },
      style: {
        description: 'The file extension to be used for style files.',
        type: 'string',
        default: 'css',
        alias: 's',
        'x-prompt': {
          message: 'Which stylesheet format would you like to use?',
          type: 'list',
          items: [
            {
              value: 'css',
              label: 'CSS',
            },
            {
              value: 'scss',
              label:
                'SASS(.scss)       [ http://sass-lang.com                     ]',
            },
            {
              value: 'less',
              label:
                'LESS              [ http://lesscss.org                       ]',
            },
            {
              value: 'styl',
              label:
                'DEPRECATED: Stylus(.styl) [ http://stylus-lang.com           ]',
            },
            {
              value: 'none',
              label: 'None',
            },
          ],
        },
      },
      unitTestRunner: {
        type: 'string',
        description: 'The unit test runner to use.',
        enum: ['none', 'jest'],
        default: 'jest',
      },
      e2eTestRunner: {
        type: 'string',
        description: 'The e2e test runner to use.',
        enum: ['none', 'cypress'],
        default: 'cypress',
      },
      directory: {
        type: 'string',
        description: 'The directory to nest the app under.',
      },
      tags: {
        type: 'array',
        description: 'The tags to assign to the project.',
        items: {
          type: 'string',
        },
        default: [],
      },
      monorepo: {
        type: 'boolean',
        description: 'Creates an integrated monorepo.',
        aliases: ['integrated'],
      },
      rootProject: {
        type: 'boolean',
        'x-priority': 'internal',
      },
    },
    required: ['name'],
  },
  description: 'Generates a React + Rspack project.',
  aliases: [],
  hidden: false,
  implementation:
    '/packages/rspack/src/generators/application/application#applicationGenerator.ts',
  path: '/packages/rspack/src/generators/application/schema.json',
  type: 'generator',
};
