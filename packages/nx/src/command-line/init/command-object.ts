import { Argv, CommandModule } from 'yargs';
import { parseCSV } from '../yargs-utils/shared-options';

export const yargsInitCommand: CommandModule = {
  command: 'init',
  describe:
    'Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up remote caching. For more info, check https://nx.dev/recipes/adopting-nx.',
  builder: (yargs) => withInitOptions(yargs),
  handler: async (args: any) => {
    try {
      const useV2 = await isInitV2();
      if (useV2) {
        await require('./init-v2').initHandler(args);
      } else {
        await require('./init-v1').initHandler(args);
      }
      process.exit(0);
    } catch {
      // Ensure the cursor is always restored just in case the user has bailed during interactive prompts
      process.stdout.write('\x1b[?25h');
      process.exit(1);
    }
  },
};

async function isInitV2() {
  return (
    process.env['NX_ADD_PLUGINS'] !== 'false' &&
    (await import('../../config/nx-json')).readNxJson().useInferencePlugins !==
      false
  );
}

async function withInitOptions(yargs: Argv) {
  const useV2 = await isInitV2();
  if (useV2) {
    return yargs
      .option('nxCloud', {
        type: 'boolean',
        description: 'Set up distributed caching with Nx Cloud.',
      })
      .option('interactive', {
        describe: 'When false disables interactive input prompts for options.',
        type: 'boolean',
        default: true,
      })
      .option('useDotNxInstallation', {
        type: 'boolean',
        description:
          'Initialize an Nx workspace setup in the .nx directory of the current repository.',
        default: false,
      })
      .option('force', {
        describe:
          'Force the migration to continue and ignore custom webpack setup or uncommitted changes. Only for CRA projects.',
        type: 'boolean',
        default: false,
      })
      .option('aiAgents', {
        type: 'array',
        string: true,
        description: 'List of AI agents to set up.',
        choices: ['claude', 'codex', 'copilot', 'cursor', 'gemini'],
      });
  } else {
    return yargs
      .option('nxCloud', {
        type: 'boolean',
        description: 'Set up remote caching with Nx Cloud.',
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
      .option('useDotNxInstallation', {
        type: 'boolean',
        description:
          'Initialize an Nx workspace setup in the .nx directory of the current repository.',
        default: false,
      })
      .option('force', {
        describe:
          'Force the migration to continue and ignore custom webpack setup or uncommitted changes. Only for CRA projects.',
        type: 'boolean',
        default: false,
      })
      .option('vite', {
        type: 'boolean',
        description: 'Use Vite as the bundler. Only for CRA projects.',
        default: true,
      })
      .option('cacheable', {
        type: 'string',
        description:
          'Comma-separated list of cacheable operations. Only used for internal testing.',
        coerce: parseCSV,
        hidden: true,
      });
  }
}
