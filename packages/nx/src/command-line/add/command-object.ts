import { CommandModule } from 'yargs';

export interface AddOptions {
  packageSpecifier: string;
  verbose?: boolean;
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
        description:
          'The package name and optional version (e.g. `@nx/react` or `@nx/react@latest`) to install and initialize',
      })
      .option('verbose', {
        type: 'boolean',
        description:
          'Prints additional information about the commands (e.g., stack traces)',
      })
      .example(
        '$0 add @nx/react',
        'Install the latest version of the `@nx/react` package and run its `@nx/react:init` generator'
      )
      .example(
        '$0 add @nx/react@17.0.0',
        'Install version `17.0.0` of the `@nx/react` package and run its `@nx/react:init` generator'
      ) as any,
  handler: (args) => import('./add').then((m) => m.addHandler(args)),
};
