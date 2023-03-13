export const schema = {
  name: 'configuration',
  factory:
    './src/generators/configuration/configuration#configurationGenerator',
  schema: {
    $schema: 'http://json-schema.org/schema',
    cli: 'nx',
    $id: 'Rspack',
    title: '',
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'The name of the project.',
        $default: {
          $source: 'argv',
          index: 0,
        },
        'x-dropdown': 'project',
        'x-prompt': 'What is the name of the project to set up a rspack for?',
        'x-priority': 'important',
      },
      main: {
        type: 'string',
        description:
          "Path relative to the workspace root for the main entry file. Defaults to '<projectRoot>/src/main.ts'.",
        'x-priority': 'important',
      },
      tsConfig: {
        type: 'string',
        description:
          "Path relative to the workspace root for the tsconfig file to build with. Defaults to '<projectRoot>/tsconfig.app.json'.",
        'x-priority': 'important',
      },
      target: {
        type: 'string',
        description:
          'Target platform for the build, same as the rspack config option.',
        enum: ['node', 'web'],
        default: 'web',
      },
      devServer: {
        type: 'boolean',
        description: 'Add a serve target to run a local rspack dev-server',
        default: false,
      },
      uiFramework: {
        type: 'string',
        description: 'The UI framework used by the project.',
        enum: ['none', 'react'],
      },
      style: {
        type: 'string',
        description: 'The style solution to use.',
        enum: ['none', 'css', 'scss', 'less'],
      },
    },
    required: ['project'],
  },
  description: 'Configures Rspack for a project.',
  aliases: [],
  hidden: false,
  implementation:
    '/packages/rspack/src/generators/configuration/configuration#configurationGenerator.ts',
  path: '/packages/rspack/src/generators/configuration/schema.json',
  type: 'generator',
};
