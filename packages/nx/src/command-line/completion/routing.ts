import {
  getProjectNameCompletions,
  getProjectNamesWithTarget,
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
 * Returns project/target completions for known nx subcommands. Returns null
 * when the routing has nothing specific to add — the caller should fall back
 * to yargs's default command/option enumeration.
 */
export function getCompletions(
  current: string,
  args: string[]
): string[] | null {
  if (args.length === 0) {
    return null;
  }

  const command = args[0];

  // nx show project <TAB>
  if (command === 'show' && args.length >= 2 && args[1] === 'project') {
    return getProjectNameCompletions(current);
  }

  // nx show target <TAB>
  if (command === 'show' && args.length >= 2 && args[1] === 'target') {
    return completeProjectTarget(current);
  }

  // nx run <project> or nx run <project>:<target>
  if (command === 'run') {
    return completeProjectTarget(current);
  }

  // nx run-many -t <TAB> / nx affected -t <TAB>
  if (command === 'run-many' || command === 'affected') {
    if (isCompletingTargetOption()) {
      return getTargetNameCompletions(current);
    }
    if (isCompletingProjectOption()) {
      return getProjectNameCompletions(current);
    }
    return null;
  }

  // Infix commands: nx build <TAB>, nx serve <TAB>, etc. Only list projects
  // that actually have the matching target — `nx build <TAB>` should not
  // suggest projects without a build target.
  if (INFIX_TARGET_COMMANDS.has(command)) {
    return getProjectNamesWithTarget(current, command);
  }

  return null;
}

// Trailing `:` after a project lets the user TAB again to complete targets
// without backspacing a shell-inserted space and typing `:` themselves. The
// bash/zsh scripts detect the trailing colon and suppress the space.
function completeProjectTarget(current: string): string[] {
  const colonIdx = current.indexOf(':');
  if (colonIdx === -1) {
    return getProjectNameCompletions(current).map((p) => `${p}:`);
  }
  const projectName = current.slice(0, colonIdx);
  const targetPrefix = current.slice(colonIdx + 1);
  return getTargetNameCompletions(targetPrefix, projectName).map(
    (t) => `${projectName}:${t}`
  );
}

/**
 * Heuristic: if the last explicit arg before current is -t, --target, or --targets,
 * we're completing a target name.
 */
function isCompletingTargetOption(): boolean {
  const rawArgs = process.argv;
  const lastArg = rawArgs[rawArgs.length - 2];
  return lastArg === '-t' || lastArg === '--target' || lastArg === '--targets';
}

function isCompletingProjectOption(): boolean {
  const rawArgs = process.argv;
  const lastArg = rawArgs[rawArgs.length - 2];
  return lastArg === '-p' || lastArg === '--projects';
}

/**
 * Returns subcommand + option completions for a matched top-level command.
 * Bypasses yargs's `defaultCompletion` because its recursion (`reset()` +
 * `builder(y, true)` + `y.argv`) wipes our `.boolean('get-yargs-completions')`
 * declaration on the inner instance, which can break the inner parse and
 * cause yargs to print help text instead of emitting completions (observed
 * for `run-many` and `affected`).
 *
 * Returns null when no top-level command is matched in `args` — yargs's
 * defaultCompletion handles top-level command-name completion (no recursion).
 */
export function getCommandCompletions(
  current: string,
  args: string[]
): string[] | null {
  // Lazy require to avoid circular dependency with nx-commands.
  const { commandsObject } = require('../nx-commands') as {
    commandsObject: any;
  };
  const handlers = commandsObject
    .getInternalMethods()
    .getCommandInstance()
    .getCommandHandlers();

  const cmdName = args.find((a) => handlers[a]);
  if (!cmdName) {
    return null;
  }
  const handler = handlers[cmdName];
  if (typeof handler.builder !== 'function') {
    return null;
  }

  // Build a fresh yargs instance, run the matched command's builder, and read
  // its registered subcommands + options. We don't access `.argv` on the temp
  // instance — that would trigger parse and the help-printing path we're
  // avoiding.
  const yargs = require('yargs') as typeof import('yargs');
  const temp: any = (yargs as any)();
  try {
    handler.builder(temp);
  } catch {
    return null;
  }

  const completions: string[] = [];
  const isFlagPrefix = current.startsWith('-');
  // Only zsh's `_describe` parses the `name:description` format. Bash's
  // `compgen -W` would insert the whole `name:description` literal as the
  // completion text — so omit descriptions when not running under zsh.
  const isZsh = isZshShell();

  // Subcommands: only relevant when user isn't typing a flag.
  if (!isFlagPrefix) {
    const subUsage = temp.getInternalMethods().getUsageInstance();
    for (const [usagePattern, desc] of subUsage.getCommands()) {
      // usagePattern is like "project [projectName]" — first token is the name.
      const subName = String(usagePattern).split(/\s+/)[0];
      if (subName === '$0') continue;
      const formatted = isZsh ? formatDescription(desc as string) : '';
      completions.push(formatted ? `${subName}:${formatted}` : subName);
    }
  }

  // Options: always relevant.
  const opts = temp.getOptions();
  const descriptions = temp
    .getInternalMethods()
    .getUsageInstance()
    .getDescriptions();
  for (const k of Object.keys(opts.key ?? {})) {
    if ((opts.hiddenOptions ?? []).includes(k)) continue;
    const desc = isZsh ? formatDescription(descriptions[k]) : '';
    completions.push(desc ? `--${k}:${desc}` : `--${k}`);
  }

  // Filter by current prefix.
  if (!current) {
    return completions;
  }
  const flagName = current.replace(/^-+/, '');
  return completions.filter((c) => {
    if (isFlagPrefix) {
      return c.startsWith(`--${flagName}`);
    }
    return c.startsWith(current);
  });
}

// Yargs prefixes some descriptions with `__yargsString__:` (its i18n marker).
// Strip that and any literal colons inside descriptions (which would confuse
// the `name:description` shell-completion format).
function formatDescription(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/^__yargsString__:/, '').replace(/:/g, '\\:');
}

function isZshShell(): boolean {
  return Boolean(
    process.env.SHELL?.includes('zsh') || process.env.ZSH_NAME?.includes('zsh')
  );
}
