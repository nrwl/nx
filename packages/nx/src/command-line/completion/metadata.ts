/**
 * Per-command completion metadata. Lives next to each command-object so
 * positional/flag completion behavior is defined where the command is
 * defined, not in a central routing file.
 *
 * Registration is path-keyed because yargs strips unknown fields from
 * CommandModule and exposes only the parsed command string for `original`,
 * so the walker can't reach back to the original object reference.
 */

export type CompletionFn = (current: string, args: string[]) => string[];

export interface PositionalCompletion {
  /** Static choices, e.g. `['inputs', 'outputs']`. */
  choices?: string[];
  /** Dynamic completion (e.g. project names from cached graph). */
  complete?: CompletionFn;
}

export interface CommandCompletionMetadata {
  /** Indexed by positional position (0 = first positional). */
  positionals?: PositionalCompletion[];
  /** Per-flag value handlers, keyed by canonical flag name (no leading `--`). */
  flags?: Record<string, CompletionFn>;
}

const REGISTRY = new Map<string, CommandCompletionMetadata>();

/**
 * Register completion metadata for a command path. Call this near the
 * command-object it describes — the path is the space-separated command
 * sequence, e.g. `'show target'` for `nx show target`, `'run'` for `nx run`.
 */
export function registerCompletion(
  path: string,
  metadata: CommandCompletionMetadata
): void {
  REGISTRY.set(path, metadata);
}

/**
 * Resolves the matching command-path metadata for the given args. Picks
 * the longest registered prefix that consists entirely of leading non-flag
 * args. Returns the metadata together with the user's positional index
 * (i.e., how many positional values they've already typed past the path).
 *
 * Yargs includes the partial token being typed in argv._, so the trailing
 * arg is the user's `current`. Subtract one to get the true positional index.
 */
export function findCompletionMetadata(
  args: string[]
): { metadata: CommandCompletionMetadata; positionalIndex: number } | null {
  // Build the prefix of leading non-flag args.
  const nonFlag: string[] = [];
  for (const arg of args) {
    if (arg.startsWith('-')) break;
    nonFlag.push(arg);
  }

  // Try longest matching prefix first, descending.
  for (let i = nonFlag.length; i > 0; i--) {
    const path = nonFlag.slice(0, i).join(' ');
    const metadata = REGISTRY.get(path);
    if (metadata) {
      // The trailing element of args is the user's current/partial token.
      // Positional index = (args typed past the path) − 1 for that partial.
      const positionalIndex = Math.max(0, nonFlag.length - i - 1);
      return { metadata, positionalIndex };
    }
  }
  return null;
}

/**
 * Resolve a flag's value-completion handler from the matched command's
 * registered metadata. Only commands that explicitly register a handler
 * for the flag participate — there is no global fallback set, so each
 * command declares the flags it owns.
 *
 * Tries the typed flag first, then any aliases yargs knows about. This
 * lets a command register only the canonical flag name (e.g. `projects`)
 * and have `-p` / `--p` resolve to the same handler.
 */
export function findFlagCompletion(
  metadata: CommandCompletionMetadata | null,
  flag: string,
  aliases: ReadonlyArray<string> = []
): CompletionFn | null {
  if (!metadata?.flags) return null;
  if (metadata.flags[flag]) return metadata.flags[flag];
  for (const a of aliases) {
    if (metadata.flags[a]) return metadata.flags[a];
  }
  return null;
}
