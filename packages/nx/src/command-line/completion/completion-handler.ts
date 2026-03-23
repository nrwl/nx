import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from './completion-providers';

/**
 * Known Nx commands that act as infix target aliases.
 * When a user types `nx build <TAB>`, we complete with project names.
 */
const INFIX_TARGET_COMMANDS = new Set([
  'build',
  'serve',
  'test',
  'lint',
  'e2e',
  'dev',
  'start',
  'preview',
  'typecheck',
]);

/**
 * Custom yargs completion handler.
 * Inspects the parsed argv to determine context and returns dynamic completions.
 * Falls through to yargs default completion (empty array) for commands and flags.
 */
export function completionHandler(
  current: string,
  argv: any,
  done: (completions: ReadonlyArray<string>) => void
): void {
  const args: string[] = argv._ ?? [];

  try {
    const completions = getCompletions(current, args, argv);
    if (completions !== null) {
      // Yargs will print the completions but won't exit the process.
      // Open daemon connections / timers keep Node alive, so we force exit
      // after giving yargs a tick to flush stdout.
      done(completions);
      setTimeout(() => process.exit(0), 0);
      return;
    }
  } catch {
    // Fall through to default on any error
  }

  done([]);
  setTimeout(() => process.exit(0), 0);
}

function getCompletions(
  current: string,
  args: string[],
  argv: Record<string, any>
): string[] | null {
  // `args` contains the positional arguments parsed by yargs.
  // For `nx show project myp`, args = ['show', 'project', 'myp']
  // `current` is the word being completed (could be empty string).

  if (args.length === 0) {
    return null; // Let yargs handle top-level command completion
  }

  const command = args[0];

  // nx show project <TAB>
  if (command === 'show' && args.length >= 2 && args[1] === 'project') {
    return getProjectNameCompletions(current);
  }

  // nx show target <TAB> — completes project:target format
  if (command === 'show' && args.length >= 2 && args[1] === 'target') {
    if (current.includes(':')) {
      const projectName = current.split(':')[0];
      const targetPrefix = current.split(':').slice(1).join(':');
      const targets = getTargetNameCompletions(targetPrefix, projectName);
      return targets.map((t) => `${projectName}:${t}`);
    }
    return getProjectNameCompletions(current);
  }

  // nx run <project> or nx run <project>:<target>
  if (command === 'run') {
    if (current.includes(':')) {
      const projectName = current.split(':')[0];
      const targetPrefix = current.split(':').slice(1).join(':');
      const targets = getTargetNameCompletions(targetPrefix, projectName);
      return targets.map((t) => `${projectName}:${t}`);
    }
    return getProjectNameCompletions(current);
  }

  // nx run-many -t <TAB> / nx affected -t <TAB>
  if (command === 'run-many' || command === 'affected') {
    // Check if we're completing after -t / --targets / --target
    if (isCompletingTargetOption()) {
      return getTargetNameCompletions(current);
    }
    // Check if we're completing after -p / --projects
    if (isCompletingProjectOption()) {
      return getProjectNameCompletions(current);
    }
    return null;
  }

  // Infix commands: nx build <TAB>, nx serve <TAB>, etc.
  if (INFIX_TARGET_COMMANDS.has(command)) {
    return getProjectNameCompletions(current);
  }

  return null; // Let yargs handle everything else
}

/**
 * Heuristic: if the last explicit arg before current is -t, --target, or --targets,
 * we're completing a target name.
 */
function isCompletingTargetOption(): boolean {
  const rawArgs = process.argv;
  const lastArg = rawArgs[rawArgs.length - 2]; // The arg before current
  return lastArg === '-t' || lastArg === '--target' || lastArg === '--targets';
}

function isCompletingProjectOption(): boolean {
  const rawArgs = process.argv;
  const lastArg = rawArgs[rawArgs.length - 2];
  return lastArg === '-p' || lastArg === '--projects';
}
