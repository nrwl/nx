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
  /**
   * Per-flag value handlers, keyed by flag name (no leading `--`).
   * Aliases are written out as separate entries pointing at the same
   * function — keeps the map uniform and lookup a single `Map.get`.
   */
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
 * `args` is the token list parsed in argv-layout.ts; its trailing element is
 * the partial the user is typing (`current`). Subtract one for that partial
 * to get the true positional index.
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
 * Resolve a flag's value-completion handler. Returns null when no handler
 * is registered for the typed flag.
 */
export function findFlagCompletion(
  metadata: CommandCompletionMetadata | null,
  flag: string
): CompletionFn | null {
  return metadata?.flags?.[flag] ?? null;
}

/**
 * Shared positional/flag-value dispatch. Used by both entry points in
 * value-completions.ts (the bin-level `tryValueCompletion` and the
 * yargs-fallback `getValueCompletions`).
 *
 * Returns `null` when no registered completion applies — the caller falls
 * through to its next strategy (command/option-name enumeration, yargs
 * defaults).
 *
 * `previousToken` is the user's last fully-typed token, i.e. the one before
 * the partial they're currently typing. Callers pass it explicitly so each
 * argv-extraction quirk stays at its own call site.
 */
export function resolveCompletion(
  args: string[],
  current: string,
  previousToken: string
): string[] | null {
  if (args.length === 0) return null;

  const match = findCompletionMetadata(args);
  const meta = match?.metadata ?? null;

  if (previousToken && previousToken.startsWith('-')) {
    const handler = findFlagCompletion(meta, previousToken.replace(/^-+/, ''));
    if (handler) return handler(current, args);
  }

  if (match) {
    const positional = match.metadata.positionals?.[match.positionalIndex];
    if (positional?.complete) return positional.complete(current, args);
    if (positional?.choices) {
      return positional.choices.filter((c) => c.startsWith(current));
    }
    return null;
  }

  return null;
}
