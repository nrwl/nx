import { CommandModule } from 'yargs';
import { handleImport } from '../../utils/handle-import';

export const yargsCompletionCommand: CommandModule = {
  command: 'completion',
  describe:
    'Output shell completion script for bash, zsh, or fish. Run `nx completion --help` for installation instructions.',
  builder: (yargs) =>
    yargs
      .command(bashCompletionCommand)
      .command(zshCompletionCommand)
      .command(fishCompletionCommand)
      .demandCommand(1, 'Please specify a shell: bash, zsh, or fish.')
      .option('force', {
        type: 'boolean',
        default: false,
        describe:
          'Generate the completion script even if `nx` is not found on PATH.',
      })
      .example('$0 completion bash >> ~/.bashrc', 'Enable bash completion')
      .example('$0 completion zsh >> ~/.zshrc', 'Enable zsh completion')
      .example(
        '$0 completion fish > ~/.config/fish/completions/nx.fish',
        'Enable fish completion'
      ),
  handler: async () => {},
};

const bashCompletionCommand: CommandModule = {
  command: 'bash',
  describe: 'Output bash completion script.',
  handler: async (args) => {
    await (
      await handleImport('./scripts.js', __dirname)
    ).printCompletionScript('bash', args);
    process.exit(0);
  },
};

const zshCompletionCommand: CommandModule = {
  command: 'zsh',
  describe: 'Output zsh completion script.',
  handler: async (args) => {
    await (
      await handleImport('./scripts.js', __dirname)
    ).printCompletionScript('zsh', args);
    process.exit(0);
  },
};

const fishCompletionCommand: CommandModule = {
  command: 'fish',
  describe: 'Output fish completion script.',
  handler: async (args) => {
    await (
      await handleImport('./scripts.js', __dirname)
    ).printCompletionScript('fish', args);
    process.exit(0);
  },
};
