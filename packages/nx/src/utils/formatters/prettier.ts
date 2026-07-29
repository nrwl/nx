import { exec, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, extname, join, resolve, dirname } from 'node:path';
import { major } from 'semver';
import type { Tree } from '../../generators/tree';
import { readJson } from '../../generators/utils/json';
import { readJsonFile } from '../fileutils';
import { handleImport } from '../handle-import';
import { readModulePackageJson } from '../package-json';
import { FORMATTER_MAX_BUFFER } from './shared';

/**
 * Config filenames prettier discovers. Exported because generator setup has to
 * agree with detection on this list - a workspace whose config format is
 * missing from one side gets a second, redundant config written next to it.
 * https://prettier.io/docs/configuration
 */
export const prettierConfigFiles = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  '.prettierrc.json5',
  '.prettierrc.js',
  'prettier.config.js',
  '.prettierrc.ts',
  'prettier.config.ts',
  '.prettierrc.mjs',
  'prettier.config.mjs',
  '.prettierrc.mts',
  'prettier.config.mts',
  '.prettierrc.cjs',
  'prettier.config.cjs',
  '.prettierrc.cts',
  'prettier.config.cts',
  '.prettierrc.toml',
];

export function isUsingPrettier(root: string): boolean {
  for (const file of prettierConfigFiles) {
    if (existsSync(join(root, file))) {
      return true;
    }
  }
  // Even if no file is present, it is possible the user is configuring prettier via their package.json
  const packageJsonPath = join(root, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = readJsonFile(packageJsonPath);
    if (packageJson.prettier) {
      return true;
    }
  }
  return false;
}

export function isUsingPrettierInTree(tree: Tree): boolean {
  for (const file of prettierConfigFiles) {
    if (tree.exists(file)) {
      return true;
    }
  }
  // Even if no file is present, it is possible the user is configuring prettier via their package.json
  if (tree.exists('package.json')) {
    const packageJson = readJson(tree, 'package.json');
    if (packageJson.prettier) {
      return true;
    }
  }
  return false;
}

/**
 * Keeps only the files prettier can format. oxfmt needs no equivalent - it
 * silently skips file types it does not handle.
 */
export async function filterToPrettierSupportedFiles(
  files: string[]
): Promise<string[]> {
  const prettier = await handleImport<typeof import('prettier')>('prettier');
  const supportedExtensions = new Set(
    (await prettier.getSupportInfo()).languages
      .flatMap((language) => language.extensions)
      .filter((extension) => !!extension)
  );
  // `.swcrc` is matched by filename, not extension: `extname('.swcrc')` is the
  // empty string, so adding it to the extension set could only ever have
  // matched a file called `something.swcrc`. `writeWithPrettier` has a
  // `--parser json` branch for these, which was unreachable while they were
  // being filtered out here.
  return files.filter(
    (file) =>
      supportedExtensions.has(extname(file)) || basename(file) === '.swcrc'
  );
}

export function writeWithPrettier(
  patterns: string[],
  // Defaults to the caller's cwd. `nx init` sets it so it can pass paths
  // relative to the repo root rather than absolute ones the user has to read.
  cwd?: string
): void {
  const [swcrcPatterns, regularPatterns] = patterns.reduce(
    (result, pattern) => {
      result[pattern.includes('.swcrc') ? 0 : 1].push(pattern);
      return result;
    },
    [[], []] as [swcrcPatterns: string[], regularPatterns: string[]]
  );
  const prettierPath = getPrettierPath();
  const listDifferentArg = shouldUseListDifferent() ? '--list-different ' : '';

  execSync(
    `node "${prettierPath}" --write ${listDifferentArg}${regularPatterns
      .map(quoteForShell)
      .join(' ')}`,
    {
      cwd,
      stdio: [0, 1, 2],
      windowsHide: true,
    }
  );

  if (swcrcPatterns.length > 0) {
    execSync(
      `node "${prettierPath}" --write ${listDifferentArg}${swcrcPatterns
        .map(quoteForShell)
        .join(' ')} --parser json`,
      {
        cwd,
        stdio: [0, 1, 2],
        windowsHide: true,
      }
    );
  }
}

export function checkWithPrettier(patterns: string[]): Promise<string[]> {
  const prettierPath = getPrettierPath();
  return new Promise((resolve, reject) => {
    exec(
      `node "${prettierPath}" --list-different ${patterns
        .map(quoteForShell)
        .join(' ')}`,
      { encoding: 'utf-8', windowsHide: true, maxBuffer: FORMATTER_MAX_BUFFER },
      (error, stdout) => {
        if (error) {
          // Same shape as the oxfmt sibling: a failure that never produced an
          // exit code - could not spawn, killed, stdout over maxBuffer -
          // reports a string `code` or none. Prettier's own "files differ"
          // signal is a numeric exit code, so those never reach here, and
          // treating them as a file list would pass `format:check` on a
          // formatter that never ran.
          if (typeof error['code'] !== 'number') {
            reject(
              new Error(
                `prettier could not be run to completion (${
                  error['code'] ?? error.signal ?? 'unknown'
                }): ${error.message}`
              )
            );
            return;
          }
          if (stdout.length === 0) {
            reject(error);
            return;
          }
          resolve(stdout.trim().split('\n'));
        } else {
          resolve([]);
        }
      }
    );
  });
}

let prettierPath: string;

export function getPrettierPath(): string {
  if (prettierPath) {
    return prettierPath;
  }

  const { packageJson, path: packageJsonPath } =
    readModulePackageJson('prettier');
  const bin = packageJson.bin;
  const binPath = typeof bin === 'string' ? bin : bin?.['prettier'];
  if (!binPath) {
    throw new Error(`Could not find prettier binary in ${packageJsonPath}`);
  }
  prettierPath = resolve(dirname(packageJsonPath), binPath);

  return prettierPath;
}

let useListDifferent: boolean | undefined;

/**
 * Determines if --list-different should be used with --write.
 * Prettier 4+ and 3.6.x with experimental CLI don't support combining these flags.
 */
function shouldUseListDifferent(): boolean {
  if (useListDifferent !== undefined) {
    return useListDifferent;
  }

  try {
    const { packageJson } = readModulePackageJson('prettier');
    const prettierMajor = major(packageJson.version);
    const isExperimentalCli = process.env.PRETTIER_EXPERIMENTAL_CLI === '1';

    useListDifferent = prettierMajor < 4 && !isExperimentalCli;
  } catch {
    useListDifferent = false;
  }

  return useListDifferent;
}

/**
 * Quote a pattern for the shell-based exec calls used by prettier. oxfmt is
 * invoked via execFile and must receive raw paths instead.
 *
 * Exported so `nx format` can size its chunks against the quoted length. The
 * patterns are chunked before they get here, and quoting afterwards grows each
 * one, which would otherwise eat into the headroom `chunkify` leaves.
 */
export function quoteForShell(pattern: string): string {
  // These patterns are interpolated into a command string, so every character
  // the shell treats specially *inside double quotes* has to be escaped, not
  // just `$`: a backtick is command substitution, a `"` closes the quoting, and
  // a backslash escapes whatever follows it. The shell consumes one level, so
  // `\$` reaches prettier as a literal `$`. Backslash is replaced first by
  // virtue of being in the same character class - a second pass would re-escape
  // the escapes.
  //
  // Windows is left alone: cmd.exe treats none of `$`, backtick or backslash as
  // special, escaping them would make prettier look for a file with the
  // backslash in its name, and `"` cannot occur in a Windows path at all.
  const escaped =
    process.platform !== 'win32'
      ? pattern.replace(/([\\"`$])/g, '\\$1')
      : pattern;
  return `"${escaped}"`;
}
