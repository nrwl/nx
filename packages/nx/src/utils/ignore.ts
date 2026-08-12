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

/** One directory's ignore files, and the directory its patterns are rooted at. */
export type ScopedIgnoreMatcher = {
  /** Workspace-relative POSIX directory, `''` for the workspace root. */
  dir: string;
  /** How they relate is decided at build time - see `merge`. */
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
 * `merge` decides how the files *within one directory* relate, and the two
 * consumers genuinely need different rules:
 *
 * - `false` is prettier's: one matcher per file, any of them excluding wins, and
 *   a negation counts only if none excluded. `createIsIgnoredFunction` builds an
 *   ignorer per `--ignore-path` and ORs them, so a `!x` in `.prettierignore`
 *   cannot re-include an `x` that `.gitignore` excluded.
 * - `true` is git's and the native walker's: all files in one matcher, so
 *   `.nxignore`'s `!x` removes `.gitignore`'s exclusion of `x` outright. It has
 *   to be a merge rather than a precedence check between separate matchers,
 *   because a lone `!x` in its own matcher reports an opinion on `x/` but *none*
 *   on `x/a.ts` (measured), so the exclusion would still reach the children.
 *   The merge only removes the exclusion within that one directory - a negation
 *   in a nested file still loses to an ancestor's exclusion.
 *
 * When `merge` is true, `filenames` order matters: they go into one matcher in
 * order and the last matching pattern decides, so list them lowest-authority
 * first.
 */
export function createIgnoreChainResolver(
  read: (path: string) => string | null | undefined,
  filenames: string[],
  merge: boolean
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
    const matchers = merge
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
 * A nested negation of a *directory* does not reach its children - see the
 * `merge` note on `createIgnoreChainResolver`.
 *
 * How the files of one directory relate is decided when the chain is built - see
 * that same note. Here they are simply the entry's matchers: any one excluding
 * wins, and a negation counts only if none excluded.
 *
 * Two preconditions, both satisfied by a pruning walk and neither enforced:
 *
 * - `filePath` is workspace-relative POSIX and must sit under every `dir` in the
 *   chain, which holds when the chain came from that file's own directory.
 * - No ancestor directory of `filePath` may itself be ignored. git refuses to
 *   re-include a file inside an excluded directory, and this does not implement
 *   that rule: asked directly about `dist/keep.ts` with a root `dist/` and a
 *   nested `dist/.gitignore` holding `!keep.ts`, it answers "not ignored" where
 *   git says ignored (measured). `visitNotIgnoredFiles` never asks, because it
 *   prunes `dist/` before descending - which is what makes its answers match
 *   git, and why that pruning is load-bearing for correctness rather than speed.
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
 * Not independent options despite the name: which files to read, whether they
 * cascade, and how the files of one directory relate are all decided by one
 * fact - the tool the decision has to agree with - so a whole set belongs to one
 * tool and mixing two tools' values gives you neither. The constructors below
 * are the only way in and none of them takes any of these as an argument, which
 * is what keeps one tool's value for one axis from reaching another's.
 */
type IgnoreCheckerOptions = {
  filenames: string[];
  cascade: boolean;
  merge: boolean;
};

/**
 * The chain bound to a tree, as predicates over workspace-relative POSIX paths.
 *
 * Files and directories are asked separately because the answers differ: a
 * pattern is only directory-only if it ends in a slash, and `ignore` will not
 * match `dist/` against the path `dist`. Callers must not have to know that, so
 * the slash is appended inside and never leaves this module.
 */
export type TreeIgnoreChecker = {
  isIgnoredFile: (path: string) => boolean;
  isIgnoredDirectory: (path: string) => boolean;
};

/**
 * What git ignores, which is also what the native walker ignores.
 *
 * `.nxignore` outranks `.gitignore` - `walker.rs` registers it with
 * `add_custom_ignore_filename` - which a merge with `.nxignore` last reproduces.
 * git itself does not read it.
 *
 * Reads from the tree rather than disk because a generator can create or amend
 * an ignore file in the same run, which would leave the on-disk copy stale.
 */
export function createGitIgnoreChecker(tree: Tree): TreeIgnoreChecker {
  return createTreeIgnoreChecker(tree, {
    filenames: ['.gitignore', '.nxignore'],
    cascade: true,
    merge: true,
  });
}

/**
 * What prettier ignores: the workspace root only, and one ignorer per
 * `--ignore-path` ORed rather than merged (both measured), so a `!` in
 * `.prettierignore` cannot re-include what `.gitignore` excluded. That is the
 * CLI `nx format:check` shells out to.
 *
 * Not an exact match for that command: `isAlwaysIgnored` is wider than
 * prettier's built-ins, and `format.ts` filters its own patterns through
 * `.nxignore`, which this does not read.
 *
 * Reads from the tree rather than disk, as above.
 */
export function createPrettierIgnoreChecker(tree: Tree): TreeIgnoreChecker {
  return createTreeIgnoreChecker(tree, {
    filenames: ['.gitignore', '.prettierignore'],
    cascade: false,
    merge: false,
  });
}

/**
 * What oxfmt ignores: prettier's two files, but resolved from each file's own
 * directory upwards rather than the workspace root - measured against the
 * oxfmt 0.60.0 CLI, which differs from prettier on exactly that axis. Still
 * one matcher per file rather than merged.
 *
 * A config's `ignorePatterns` is not an ignore file and is not read here;
 * `formatFilesWithOxfmt` applies it rooted at that config's directory.
 */
export function createOxfmtIgnoreChecker(tree: Tree): TreeIgnoreChecker {
  return createTreeIgnoreChecker(tree, OXFMT_IGNORE_OPTIONS);
}

/**
 * Exported, unlike git's and prettier's, because oxfmt has two consumers:
 * this tree-backed checker and the disk-backed resolver in
 * `formatters/oxfmt.ts`. A shared value is the only thing that keeps them
 * agreeing, so do not restate these three anywhere.
 *
 * `satisfies` rather than an annotation keeps the values literal - an
 * annotation widens `cascade` and `merge` to `boolean` (measured in the
 * declaration emit).
 */
export const OXFMT_IGNORE_OPTIONS = {
  filenames: ['.gitignore', '.prettierignore'],
  cascade: true,
  merge: false,
} satisfies IgnoreCheckerOptions;

function createTreeIgnoreChecker(
  tree: Tree,
  { filenames, cascade, merge }: IgnoreCheckerOptions
): TreeIgnoreChecker {
  const resolve = createIgnoreChainResolver(
    (path) => tree.read(path, 'utf-8'),
    filenames,
    merge
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
