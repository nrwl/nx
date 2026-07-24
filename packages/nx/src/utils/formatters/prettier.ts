import { exec, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { major } from 'semver';
import type { Tree } from '../../generators/tree';
import { readJson } from '../../generators/utils/json';
import { readJsonFile } from '../fileutils';
import { handleImport } from '../handle-import';
import { readModulePackageJson } from '../package-json';
import { FORMATTER_MAX_BUFFER } from './shared';

/**
 * Possible configuration files are taken from https://prettier.io/docs/configuration
 */
const configFiles = [
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
  for (const file of configFiles) {
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
  for (const file of configFiles) {
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
      // Prettier supports ".swcrc" as a file, not an extension, so add it here.
      .concat('.swcrc')
  );
  return files.filter((f) => supportedExtensions.has(extname(f)));
}

export function writeWithPrettier(patterns: string[]): void {
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
          if (stdout.length === 0) {
            reject(error);
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

function getPrettierPath(): string {
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
 */
function quoteForShell(pattern: string): string {
  // On non-Windows, escape $ to prevent shell variable interpolation
  // (the shell consumes one \, so \\$ becomes \$ which the shell treats as literal $)
  // On Windows (cmd.exe), $ is not a special character, so escaping it would
  // cause prettier to look for a file with a literal \$ in the name
  // prettier-ignore
  const escaped = process.platform !== 'win32' ? pattern.replace(/\$/g, '\\\$') : pattern;
  return `"${escaped}"`;
}
