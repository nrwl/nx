import { Type, Static } from '@sinclair/typebox';
import { TStringUnion } from '@nrwl/devkit/typebox-extensions';

export type Schema = Static<typeof JsonSchema>;

export const JsonSchema = Type.Object(
  {
    project: Type.String({
      description: 'The name of the project.',
      alias: 'p',
      $default: {
        $source: 'projectName',
      },
      'x-prompt': 'What is the name of the project for the generator?',
    }),
    name: Type.String({
      description: 'Generator name.',
      $default: {
        $source: 'argv',
        index: 0,
      },
      'x-prompt': 'What name would you like to use for the generator?',
    }),
    description: Type.Optional(
      Type.String({
        description: 'Generator description.',
        alias: 'd',
      })
    ),
    unitTestRunner: Type.Optional(
      TStringUnion(['jest', 'none'], {
        description: 'Test runner to use for unit tests.',
        default: 'jest',
      })
    ),
  },
  {
    $id: 'NxPluginGenerator',
    title: 'Create a Generator for an Nx Plugin',
    description: 'Create a Generator for an Nx Plugin.',
    type: 'object',
    cli: 'nx',
    examples: [
      {
        command: 'nx g generator my-generator --project=my-plugin',
        description: 'Generate `libs/my-plugin/src/generators/my-generator`',
      },
    ],
    additionalProperties: false,
  }
);
