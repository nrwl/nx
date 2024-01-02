import { CommandModule } from 'yargs';

export interface AddOptions {
  packageSpecifier: string;
}

export const yargsAddCommand: CommandModule<
  Record<string, unknown>,
  AddOptions
> = {
  command: 'add <packageSpecifier>',
  describe: 'Install a plugin and initialize it.',
  builder: (yargs) =>
    yargs
      .positional('packageSpecifier', {
        type: 'string',
        description: 'The name of an installed plugin to query',
      })
      .example(
        '$0 add @nx/react',
        'Install the latest version of the `@nx/react` package and run its `@nx/react:init` generator'
      )
      .example(
        '$0 add @nx/react@17.0.0',
        'Install the version `17.0.0` of the `@nx/react` package and run its `@nx/react:init` generator'
      ),
  handler: (args) => import('./add').then((m) => m.addHandler(args)),
};
