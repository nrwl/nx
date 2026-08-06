import ignore = require('ignore');
import { getHardcodedIgnorePatterns } from '../native/index';
import { readFileIfExisting } from './fileutils';
import { workspaceRoot } from './workspace-root';
import { Tree } from '../generators/tree';

export function getIgnoreObject(
  root: string = workspaceRoot
): ReturnType<typeof ignore> {
  const ig = ignore();
  ig.add(readFileIfExisting(`${root}/.gitignore`));
  ig.add(readFileIfExisting(`${root}/.nxignore`));
  return ig;
}

/**
 * How the ignore files *within one directory* combine. The two consumers answer
 * to different authorities and genuinely need different rules:
 *
 * - `separate` is prettier's: one matcher per file, any of them excluding wins,
 *   and a negation counts only if none excluded. `createIsIgnoredFunction`
 *   builds an ignorer per `--ignore-path` and ORs them, so a `!x` in
 *   `.prettierignore` cannot re-include an `x` that `.gitignore` excluded.
 * - `merged` is git's and the native walker's: all files in one matcher, so
 *   `.nxignore`'s `!x` removes `.gitignore`'s exclusion of `x` outright. It has
 *   to be a merge rather than a precedence check between separate matchers,
 *   because a lone `!x` in its own matcher reports an opinion on `x/` but *none*
 *   on `x/a.ts` (measured), so the exclusion would still reach the children.
 *   Note the merge only removes the exclusion within that one directory - a
 *   negation in a nested file still loses to an ancestor's exclusion, matching
 *   what the helper this replaced did.
 */
export type IgnoreCombineMode = 'separate' | 'merged';

/** One directory's ignore files, and the directory its patterns are rooted at. */
export type ScopedIgnoreMatcher = {
  /** Workspace-relative POSIX directory, `''` for the workspace root. */
  dir: string;
  /** How they relate is decided at build time - see `IgnoreCombineMode`. */
  matchers: ReturnType<typeof ignore>[];
};

/**
 * Resolves the ignore files that apply to a directory: its own and every one
 * above it, up to the workspace root.
 *
 * Ignore files cascade - a `.gitignore` covers its own directory and below, and
 * its patterns are relative to *itself*, not to the workspace root. Reading only
 * the root file, which is what `getIgnoreObject` does, silently misses every
 * nested one.
 *
 * A directory's answer is its own files plus its parent's, so every directory on
 * the way up is memoized rather than only the one asked for: sibling leaves
 * share the whole trunk, and a later walk stops at the first directory already
 * known.
 *
 * `read` decides where the files come from - `tree.read` for a generator, disk
 * for a caller with no tree - and returns an empty string or null when there is
 * no such file. Paths handed to it are workspace-relative POSIX.
 *
 * `filenames` order matters when `combine` is `merged`: they go into one matcher
 * in order and the last matching pattern decides, so list them
 * lowest-authority first.
 */
export function createIgnoreChainResolver(
  read: (path: string) => string | null | undefined,
  filenames: string[],
  combine: IgnoreCombineMode
): (dir: string) => ScopedIgnoreMatcher[] {
  const cache = new Map<string, ScopedIgnoreMatcher[]>();

  const resolve = (dir: string): ScopedIgnoreMatcher[] => {
    const cached = cache.get(dir);
    if (cached) {
      return cached;
    }

    const contents = filenames
      .map((name) => read(dir ? `${dir}/${name}` : name))
      .filter((c): c is string => !!c);
    const matchers =
      combine === 'merged'
        ? contents.length > 0
          ? [contents.reduce((m, c) => m.add(c), ignore())]
          : []
        : contents.map((c) => ignore().add(c));

    const inherited = dir === '' ? [] : resolve(posixDirname(dir));
    const chain =
      matchers.length > 0 ? [{ dir, matchers }, ...inherited] : inherited;

    cache.set(dir, chain);
    return chain;
  };

  return resolve;
}

/**
 * True when the file is ignored, resolving the chain nearest file first.
 *
 * Each matcher is tested against the path relative to its own directory, which
 * is what makes a nested pattern like `/build` mean that directory's `build`
 * rather than the workspace's.
 *
 * Nearest directory with an *opinion* wins, not the first match: a nested
 * `!keep.log` must override the root's `*.log`, which is git's rule for files.
 * A nested negation of a *directory* does not reach its children - see
 * `IgnoreCombineMode`.
 *
 * How the files of one directory combine is decided when the chain is built -
 * see `IgnoreCombineMode`. Here they are simply the entry's matchers: any one
 * excluding wins, and a negation counts only if none excluded.
 *
 * `filePath` is workspace-relative POSIX and must sit under every `dir` in the
 * chain - which holds when the chain came from that file's own directory.
 */
export function isIgnoredByChain(
  chain: ScopedIgnoreMatcher[],
  filePath: string
): boolean {
  for (const { dir, matchers } of chain) {
    const relative = dir === '' ? filePath : filePath.slice(dir.length + 1);
    let unignored = false;
    for (const matcher of matchers) {
      const result = matcher.test(relative);
      if (result.ignored) {
        return true;
      }
      unignored ||= result.unignored;
    }
    if (unignored) {
      return false;
    }
  }
  return false;
}

let alwaysIgnored: ReturnType<typeof ignore> | undefined;

/**
 * Directories that should never be walked, whatever the workspace's own ignore
 * files say - `node_modules`, `.git`, the nx caches.
 *
 * The list comes from the native walker rather than a second copy here, so a
 * filesystem walk and a tree walk cannot drift apart.
 *
 * Checked ahead of the cascading chain rather than folded into it: these are not
 * re-includable, and as ordinary patterns a nested negation could resurrect
 * `node_modules`.
 */
export function isAlwaysIgnored(path: string): boolean {
  alwaysIgnored ??= ignore().add(getHardcodedIgnorePatterns());
  return alwaysIgnored.ignores(path);
}

/**
 * Which files to read, whether they cascade, and how the files of one directory
 * relate are all decided by one fact - the tool this has to agree with - so the
 * caller states that and nothing else. As separate options the two consumers'
 * values could be mixed, and picking one wrong is a silent behaviour change
 * across every caller.
 */
const AUTHORITIES = {
  // git, and the native walker: ignore files cascade, and `.nxignore` outranks
  // `.gitignore` (`walker.rs` registers it with `add_custom_ignore_filename`),
  // which a merge with `.nxignore` last reproduces.
  git: {
    filenames: ['.gitignore', '.nxignore'],
    cascade: true,
    combine: 'merged',
  },
  // prettier: resolves ignore files from the workspace root only, and ORs one
  // ignorer per `--ignore-path` rather than merging them (both measured), which
  // is the CLI `nx format:check` shells out to. Not an exact match for that
  // command: `isAlwaysIgnored` below also skips the nx and yarn caches, and
  // `format.ts` filters its own patterns through `.nxignore`, which this does
  // not read.
  prettier: {
    filenames: ['.gitignore', '.prettierignore'],
    cascade: false,
    combine: 'separate',
  },
} satisfies Record<
  string,
  { filenames: string[]; cascade: boolean; combine: IgnoreCombineMode }
>;

/**
 * The tool an ignore decision has to agree with. `git` also covers the native
 * walker, which is where `.nxignore` comes from - git itself does not read it.
 */
export type IgnoreAuthority = keyof typeof AUTHORITIES;

/**
 * The chain bound to a tree, as predicates over workspace-relative POSIX paths.
 *
 * Reads from the tree rather than disk because a generator can create or amend
 * an ignore file in the same run, which would leave the on-disk copy stale.
 *
 * Files and directories are asked separately because the answers differ: a
 * pattern is only directory-only if it ends in a slash, and `ignore` will not
 * match `dist/` against the path `dist`. Callers must not have to know that, so
 * the slash is appended here and never leaves this module.
 */
export function createTreeIgnoreChecker(
  tree: Tree,
  authority: IgnoreAuthority
): {
  isIgnoredFile: (path: string) => boolean;
  isIgnoredDirectory: (path: string) => boolean;
} {
  const { filenames, cascade, combine } = AUTHORITIES[authority];
  const resolve = createIgnoreChainResolver(
    (path) => tree.read(path, 'utf-8'),
    filenames,
    combine
  );

  // `probe` may carry a trailing slash; `path` never does. The chain is keyed by
  // real directories, and `posixDirname('dist/')` is `'dist'` rather than the
  // parent, so the lookup always uses the slash-less form.
  const check = (path: string, probe: string) =>
    isAlwaysIgnored(probe) ||
    isIgnoredByChain(resolve(cascade ? posixDirname(path) : ''), probe);

  return {
    isIgnoredFile: (path) => check(path, path),
    isIgnoredDirectory: (path) => check(path, `${path}/`),
  };
}

/**
 * `path.dirname` for the workspace-relative POSIX paths the chain is keyed by,
 * except that the workspace root is `''` rather than `.` - that is the key
 * `createIgnoreChainResolver` terminates on.
 */
export function posixDirname(relativePath: string): string {
  const separator = relativePath.lastIndexOf('/');
  return separator === -1 ? '' : relativePath.slice(0, separator);
}

/**
 * Adds an entry to a .gitignore file if it's not already covered by existing patterns.
 * Creates the file if it doesn't exist.
 */
export function addEntryToGitIgnore(
  tree: Tree,
  gitignorePath: string,
  entry: string
) {
  const gitignore = tree.exists(gitignorePath)
    ? tree.read(gitignorePath, 'utf-8')
    : '';
  const ig = ignore();
  ig.add(gitignore);
  if (!ig.ignores(entry)) {
    const updatedLines = gitignore.length ? [gitignore, entry] : [entry];
    tree.write(gitignorePath, updatedLines.join('\n'));
  }
}
