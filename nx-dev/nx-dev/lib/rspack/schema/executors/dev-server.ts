export const schema = {
  name: 'dev-server',
  implementation:
    '/packages/rspack/src/executors/dev-server/dev-server.impl.ts',
  schema: {
    $schema: 'http://json-schema.org/schema',
    version: 2,
    cli: 'nx',
    title: 'Rspack dev-server executor',
    description: '',
    type: 'object',
    properties: {
      buildTarget: {
        type: 'string',
        description: 'The build target for rspack.',
      },
      port: {
        type: 'number',
        description: 'The port to for the dev-server to listen on.',
      },
      mode: {
        type: 'string',
        description: 'Mode to run the server in.',
        enum: ['development', 'production', 'none'],
      },
    },
    required: ['buildTarget'],
    presets: [],
  },
  description: 'Serve a web application.',
  aliases: [],
  hidden: false,
  path: '/packages/rspack/src/executors/dev-server/schema.json',
  type: 'executor',
};
