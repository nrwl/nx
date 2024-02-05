import { CommandModule } from 'yargs';

export interface AddOptions {
  packageSpecifier: string;
  updatePackageScripts?: boolean;
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
          'The package name and optional version (e.g. `@nx/react` or `@nx/react@latest`) to install and initialize. If the version is not specified it will install the same version as the `nx` package for Nx core plugins or the latest version for other packages',
      })
      .option('updatePackageScripts', {
        type: 'boolean',
        description:
          'Update `package.json` scripts with inferred targets. Defaults to `true` when the package is a core Nx plugin',
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
        '$0 add non-core-nx-plugin',
        'Install the latest version of the `non-core-nx-plugin` package and run its `non-core-nx-plugin:init` generator if available'
      )
      .example(
        '$0 add @nx/react@17.0.0',
        'Install version `17.0.0` of the `@nx/react` package and run its `@nx/react:init` generator'
      ) as any,
  handler: (args) => import('./add').then((m) => m.addHandler(args)),
};
