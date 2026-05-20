import { CommandModule } from 'yargs';
import { handleImport } from '../../utils/handle-import';

const SHELL_CHOICES = ['bash', 'zsh', 'fish', 'powershell'] as const;
type Shell = (typeof SHELL_CHOICES)[number];

interface CompletionArgs {
  shell?: Shell;
  force?: boolean;
  stdout?: boolean;
}

export const yargsCompletionCommand: CommandModule<{}, CompletionArgs> = {
  command: 'completion [shell]',
  describe:
    'Install shell completion for bash, zsh, fish, or powershell. Omit the shell to pick interactively.',
  builder: (yargs) =>
    yargs
      .positional('shell', {
        type: 'string',
        choices: SHELL_CHOICES,
        describe: 'Shell to install completion for.',
      })
      .option('force', {
        type: 'boolean',
        default: false,
        describe:
          'Install the completion script even if `nx` is not found on PATH.',
      })
      .option('stdout', {
        type: 'boolean',
        default: false,
        describe:
          'Print the completion script to stdout instead of writing to the shell rc file.',
      })
      .example('$0 completion bash', 'Install bash completion to ~/.bashrc')
      .example(
        '$0 completion',
        'Pick shells interactively and install completion for each'
      )
      .example(
        '$0 completion bash --stdout >> ~/.bash_profile',
        'Print to stdout for a custom rc location'
      ) as any,
  handler: async (args) => {
    const scripts = await handleImport('./scripts.js', __dirname);
    const emit = args.stdout
      ? scripts.printCompletionScript
      : scripts.installCompletionScript;
    const shells = args.shell ? [args.shell] : await pickShellsInteractively();
    if (shells.length === 0) {
      console.warn('nx: no shells selected — nothing installed.');
      process.exit(0);
    }
    // Fire the PATH-advisory once, before any per-shell emit.
    if (!args.force) scripts.maybeWarnNxNotOnPath();
    for (const shell of shells) emit(shell);
    process.exit(0);
  },
};

async function pickShellsInteractively(): Promise<Shell[]> {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    console.warn(
      'nx: please specify a shell — `nx completion <bash|zsh|fish|powershell>`.'
    );
    process.exit(1);
  }
  const { prompt } = (await import('enquirer')) as any;
  const answer = (await prompt({
    type: 'multiselect',
    name: 'shells',
    message: 'Install nx completion for which shell(s)?',
    choices: SHELL_CHOICES.map((name) => ({ name, value: name })),
  })) as { shells?: Shell[] };
  return answer.shells ?? [];
}
