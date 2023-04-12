export const schema = {
  name: 'rspack',
  implementation: '/packages/rspack/src/executors/rspack/rspack.impl.ts',
  schema: {
    $schema: 'http://json-schema.org/schema',
    version: 2,
    cli: 'nx',
    title: 'Rspack build executor',
    description: '',
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'The platform to target (e.g. web, node).',
        enum: ['web', 'node'],
      },
      main: {
        type: 'string',
        description: 'The main entry file.',
      },
      outputPath: {
        type: 'string',
        description: 'The output path for the bundle.',
      },
      tsConfig: {
        type: 'string',
        description: 'The tsconfig file to build the project.',
      },
      indexHtml: {
        type: 'string',
        description: 'The path to the index.html file.',
      },
      rspackConfig: {
        type: 'string',
        description: 'The path to the rspack config file.',
      },
      optimization: {
        type: 'boolean',
        description: 'Enables optimization of the build output.',
      },
      sourceMap: {
        description:
          "Output sourcemaps. Use 'hidden' for use with error reporting tools without generating sourcemap comment.",
        default: true,
        oneOf: [
          {
            type: 'boolean',
          },
          {
            type: 'string',
          },
        ],
      },
      assets: {
        type: 'array',
        description: 'List of static application assets.',
        default: [],
        items: {
          $ref: '#/definitions/assetPattern',
        },
      },
      mode: {
        type: 'string',
        description: 'Mode to run the build in.',
        enum: ['development', 'production', 'none'],
      },
    },
    required: ['target', 'main', 'outputPath', 'tsConfig', 'rspackConfig'],
    definitions: {
      assetPattern: {
        oneOf: [
          {
            type: 'object',
            properties: {
              glob: {
                type: 'string',
                description: 'The pattern to match.',
              },
              input: {
                type: 'string',
                description:
                  "The input directory path in which to apply 'glob'. Defaults to the project root.",
              },
              ignore: {
                description: 'An array of globs to ignore.',
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              output: {
                type: 'string',
                description: 'Absolute path within the output.',
              },
            },
            additionalProperties: false,
            required: ['glob', 'input', 'output'],
          },
          {
            type: 'string',
          },
        ],
      },
    },
    presets: [],
  },
  description: 'Run rspack build.',
  aliases: [],
  hidden: false,
  path: '/packages/rspack/src/executors/rspack/schema.json',
  type: 'executor',
};
