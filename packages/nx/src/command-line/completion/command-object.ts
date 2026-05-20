import { CommandModule } from 'yargs';
import { handleImport } from '../../utils/handle-import';

export const yargsCompletionCommand: CommandModule = {
  command: 'completion',
  describe:
    'Output shell completion script for bash, zsh, fish, or powershell. Run `nx completion --help` for installation instructions.',
  builder: (yargs) =>
    yargs
      .command(bashCompletionCommand)
      .command(zshCompletionCommand)
      .command(fishCompletionCommand)
      .command(powershellCompletionCommand)
      .demandCommand(
        1,
        'Please specify a shell: bash, zsh, fish, or powershell.'
      )
      .option('force', {
        type: 'boolean',
        default: false,
        describe:
          'Generate the completion script even if `nx` is not found on PATH.',
      })
      .example('$0 completion bash >> ~/.bashrc', 'Enable bash completion')
      .example('$0 completion zsh >> ~/.zshrc', 'Enable zsh completion')
      .example(
        'mkdir -p ~/.config/fish/completions && $0 completion fish > ~/.config/fish/completions/nx.fish',
        'Enable fish completion (mkdir is needed because fish does not auto-create the parent directory on redirect)'
      )
      .example(
        '$0 completion powershell | Out-File -Append $PROFILE',
        'Enable PowerShell completion'
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

const powershellCompletionCommand: CommandModule = {
  command: 'powershell',
  describe: 'Output PowerShell completion script.',
  handler: async (args) => {
    await (
      await handleImport('./scripts.js', __dirname)
    ).printCompletionScript('powershell', args);
    process.exit(0);
  },
};
