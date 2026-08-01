// Per-command completion metadata. Path-keyed because yargs doesn't
// preserve command-object references through its parse.

export type CompletionFn = (current: string, args: string[]) => string[];

export interface PositionalCompletion {
  choices?: string[];
  complete?: CompletionFn;
}

export interface CommandCompletionMetadata {
  positionals?: PositionalCompletion[];
  /** Flag value handlers, keyed without leading `--`. Aliases get their own
   *  entry pointing at the same function. */
  flags?: Record<string, CompletionFn>;
}

const REGISTRY = new Map<string, CommandCompletionMetadata>();

export function registerCompletion(
  path: string,
  metadata: CommandCompletionMetadata
): void {
  REGISTRY.set(path, metadata);
}

/** Single-token registered paths (infix targets etc.). */
export function getRegisteredTopLevelPaths(): string[] {
  const paths: string[] = [];
  for (const path of REGISTRY.keys()) {
    if (!path.includes(' ')) paths.push(path);
  }
  return paths;
}

/** Longest-prefix match against the leading non-flag args. */
export function findCompletionMetadata(
  args: string[]
): { metadata: CommandCompletionMetadata; positionalIndex: number } | null {
  const nonFlag: string[] = [];
  for (const arg of args) {
    if (arg.startsWith('-')) break;
    nonFlag.push(arg);
  }

  for (let i = nonFlag.length; i > 0; i--) {
    const path = nonFlag.slice(0, i).join(' ');
    const metadata = REGISTRY.get(path);
    if (metadata) {
      const positionalIndex = Math.max(0, nonFlag.length - i - 1);
      return { metadata, positionalIndex };
    }
  }
  return null;
}

export function findFlagCompletion(
  metadata: CommandCompletionMetadata | null,
  flag: string
): CompletionFn | null {
  return metadata?.flags?.[flag] ?? null;
}

/** Positional/flag-value dispatch. Returns null when no handler applies. */
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
    // The user is typing a flag's value but we don't have a handler for
    // this flag. Emit no candidates so the shell wrapper falls back to its
    // native default (filename/dirname completion in bash via `-o default`).
    // Crucially, do NOT fall through to positional dispatch — that would
    // offer wrong candidates (e.g. project names for `nx g app --directory <TAB>`).
    return [];
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
