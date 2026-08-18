import { prompt } from 'enquirer';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { Argv, CommandModule } from 'yargs';
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
  builder: (yargs) => {
    const y = withCompletionOptions(yargs);
    // Yargs' built-in help is disabled (see nx-commands.ts) and this command
    // skips initLocal's --help handling, so handle it in the builder like init.
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      y.showHelp();
      process.exit(0);
    }
    return y;
  },
  handler: async (args) => {
    const scripts = await handleImport('./scripts.js', __dirname);
    const shells = args.shell ? [args.shell] : await pickShellsInteractively();
    if (shells.length === 0) {
      console.warn('nx: no shells selected — nothing installed.');
      process.exit(0);
    }
    if (args.stdout && shells.length > 1) {
      console.warn(
        'nx: --stdout only makes sense with one shell — concatenating two wrapper scripts to stdout is never useful.'
      );
      process.exit(1);
    }
    const emit = args.stdout
      ? scripts.printCompletionScript
      : scripts.installCompletionScript;
    // Fire the PATH-advisory once, before any per-shell emit.
    if (!args.force) scripts.maybeWarnNxNotOnPath();
    for (const shell of shells) emit(shell);
    process.exit(0);
  },
};

function withCompletionOptions(yargs: Argv) {
  return yargs
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
    ) as any;
}

async function pickShellsInteractively(): Promise<Shell[]> {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    console.warn(
      'nx: please specify a shell — `nx completion <bash|zsh|fish|powershell>`.'
    );
    process.exit(1);
  }
  const detected = detectAvailableShells();
  const answer = (await prompt({
    type: 'multiselect',
    name: 'shells',
    message: 'Install nx completion for which shell(s)?',
    choices: SHELL_CHOICES.map((name) => ({
      name,
      value: name,
      // Pre-check shells we can detect on this machine.
      enabled: detected.has(name),
    })),
  })) as { shells?: Shell[] };
  return answer.shells ?? [];
}

/** Best-effort detect-which-shells-the-user-has. Pre-checks the multiselect.
 *  Signals: $SHELL basename, presence of conventional rc files, $PSModulePath
 *  for PowerShell. False positives are fine — the user can uncheck. */
function detectAvailableShells(): Set<Shell> {
  const found = new Set<Shell>();
  const home = homedir();
  const shellEnv = (process.env.SHELL ?? '').replace(/\\/g, '/');
  const shellName = shellEnv.split('/').pop() ?? '';

  if (shellName === 'bash' || existsSync(join(home, '.bashrc'))) {
    found.add('bash');
  }
  if (shellName === 'zsh' || existsSync(join(home, '.zshrc'))) {
    found.add('zsh');
  }
  if (
    shellName === 'fish' ||
    existsSync(join(home, '.config', 'fish', 'config.fish'))
  ) {
    found.add('fish');
  }
  if (process.env.PSModulePath || process.platform === 'win32') {
    found.add('powershell');
  }
  return found;
}
