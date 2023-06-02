import { CommandModule, Argv } from 'yargs';
import { parseCSV } from '../yargs-utils/shared-options';

export const yargsInitCommand: CommandModule = {
  command: 'init',
  describe:
    'Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up distributed caching. For more info, check https://nx.dev/recipes/adopting-nx.',
  builder: (yargs) => withInitOptions(yargs),
  handler: async (args: any) => {
    await (await import('./init')).initHandler(args);
    process.exit(0);
  },
};

function withInitOptions(yargs: Argv) {
  return yargs
    .options('nxCloud', {
      type: 'boolean',
      description: 'Set up distributed caching with Nx Cloud.',
    })
    .option('interactive', {
      describe: 'When false disables interactive input prompts for options.',
      type: 'boolean',
      default: true,
    })
    .option('integrated', {
      type: 'boolean',
      description:
        'Migrate to an Nx integrated layout workspace. Only for Angular CLI workspaces and CRA projects.',
      default: false,
    })
    .option('addE2e', {
      describe:
        'Set up Cypress E2E tests in integrated workspaces. Only for CRA projects.',
      type: 'boolean',
      default: false,
    })
    .option('force', {
      describe:
        'Force the migration to continue and ignore custom webpack setup or uncommitted changes. Only for CRA projects.',
      type: 'boolean',
      default: false,
    })
    .options('vite', {
      type: 'boolean',
      description: 'Use Vite as the bundler. Only for CRA projects.',
      default: true,
    })
    .options('cacheable', {
      type: 'string',
      description:
        'Comma-separated list of cacheable operations. Only used for internal testing.',
      coerce: parseCSV,
      hidden: true,
    });
}
