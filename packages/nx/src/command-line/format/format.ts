import { exec, execFile, execFileSync, execSync } from 'node:child_process';
import * as path from 'node:path';
import { major } from 'semver';
import * as yargs from 'yargs';
import { readNxJson } from '../../config/configuration';
import { ProjectGraph } from '../../config/project-graph';
import {
  getRootTsConfigFileName,
  getRootTsConfigPath,
} from '../../plugins/js/utils/typescript';
import { filterAffected } from '../../project-graph/affected/affected-project-graph';
import { calculateFileChanges } from '../../project-graph/file-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { chunkify } from '../../utils/chunkify';
import {
  getProjectRoots,
  NxArgs,
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { fileExists, readJsonFile, writeJsonFile } from '../../utils/fileutils';
import { handleImport } from '../../utils/handle-import';
import { getIgnoreObject } from '../../utils/ignore';
import { sortObjectByKeys } from '../../utils/object-sort';
import { output } from '../../utils/output';
import { readModulePackageJson } from '../../utils/package-json';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  detectFormatter,
  FORMATTER_MAX_BUFFER,
  type FormatterType,
} from '../../utils/formatter';
import { getOxfmtBinPath } from '../../utils/oxfmt';

export async function format(
  command: 'check' | 'write',
  args: yargs.Arguments
): Promise<void> {
  const formatterType = detectFormatter(workspaceRoot);

  if (!formatterType) {
    output.warn({
      title: 'No formatter configured.',
      bodyLines: ['Install oxfmt or prettier to enable formatting.'],
    });
    return;
  }

  const { nxArgs } = splitArgsIntoNxArgsAndOverrides(
    args,
    'affected',
    { printWarnings: false },
    readNxJson()
  );

  // Patterns are kept raw here. Prettier is invoked through a shell so it
  // quotes them at the call site; oxfmt is invoked with execFile and needs
  // the unquoted paths.
  const patterns = await getPatterns(formatterType, {
    ...args,
    ...nxArgs,
  } as any);

  // Chunkify the patterns array to prevent crashing the windows terminal
  const chunkList: string[][] = chunkify(patterns);

  switch (command) {
    case 'write':
      if (nxArgs.sortRootTsconfigPaths) {
        sortTsConfig();
      }
      addRootConfigFiles(chunkList, nxArgs);
      chunkList.forEach((chunk) => write(formatterType, chunk));
      break;
    case 'check': {
      const filesWithDifferentFormatting = [];
      for (const chunk of chunkList) {
        const files = await check(formatterType, chunk);
        filesWithDifferentFormatting.push(...files);
      }
      if (filesWithDifferentFormatting.length > 0) {
        if (nxArgs.verbose) {
          output.error({
            title: 'The following files are not formatted correctly',
            bodyLines: [
              '- Run "nx format:write" and commit the resulting diff to fix these files.',
              '',
              ...filesWithDifferentFormatting,
            ],
          });
        } else {
          console.log(filesWithDifferentFormatting.join('\n'));
        }
        process.exit(1);
      }
      break;
    }
  }
}

async function getPatterns(
  formatterType: FormatterType,
  args: NxArgs & { libsAndApps: boolean; _: string[] }
): Promise<string[]> {
  const allFilesPattern = ['.'];

  if (args.all) {
    return allFilesPattern;
  }

  try {
    if (args.projects && args.projects.length > 0) {
      const graph = await createProjectGraphAsync({ exitOnError: true });
      return getPatternsFromProjects(args.projects, graph);
    }

    const p = parseFiles(args);

    // Deleted files still show up in the changed-file set, and neither
    // formatter should be handed a path that is no longer there.
    let patterns = p.files
      .map((f) => path.relative(workspaceRoot, f))
      .filter((f) => fileExists(f));

    if (formatterType === 'prettier') {
      // oxfmt needs no equivalent filter - it silently skips file types it
      // does not handle, and OXFMT_BASE_ARGS keeps an all-skipped run green.
      const prettier = await handleImport('prettier');
      const supportedExtensions = new Set(
        (await prettier.getSupportInfo()).languages
          .flatMap((language) => language.extensions)
          .filter((extension) => !!extension)
          .concat('.swcrc')
      );
      patterns = patterns.filter((f) =>
        supportedExtensions.has(path.extname(f))
      );
    }

    const nonIgnoredPatterns = getIgnoreObject().filter(patterns);

    if (args.libsAndApps) {
      return getPatternsFromApps(nonIgnoredPatterns);
    }
    return nonIgnoredPatterns;
  } catch (err) {
    output.error({
      title:
        err?.message ||
        'Something went wrong when resolving the list of files for the formatter',
      bodyLines: [`Defaulting to all files pattern: "${allFilesPattern}"`],
    });
    return allFilesPattern;
  }
}

async function getPatternsFromApps(affectedFiles: string[]): Promise<string[]> {
  const graph = await createProjectGraphAsync({
    exitOnError: true,
  });
  const affectedGraph = await filterAffected(
    graph,
    calculateFileChanges(affectedFiles)
  );
  return getPatternsFromProjects(
    Object.keys(affectedGraph.nodes),
    affectedGraph
  );
}

function addRootConfigFiles(chunkList: string[][], nxArgs: NxArgs): void {
  if (nxArgs.all) {
    return;
  }
  const chunk = [];
  const addToChunkIfNeeded = (file: string) => {
    if (chunkList.every((c) => !c.includes(file))) {
      chunk.push(file);
    }
  };
  ['nx.json', getRootTsConfigFileName()]
    .filter(Boolean)
    .forEach(addToChunkIfNeeded);

  if (chunk.length > 0) {
    chunkList.push(chunk);
  }
}

function getPatternsFromProjects(
  projects: string[],
  projectGraph: ProjectGraph
): string[] {
  return getProjectRoots(projects, projectGraph);
}

/**
 * oxfmt silently skips paths it does not recognise, and exits 2 when *every*
 * path was skipped. Nx routinely passes mixed file lists, so treat an empty
 * match as success rather than a failure.
 */
const OXFMT_BASE_ARGS = ['--no-error-on-unmatched-pattern'];

const enum OxfmtExitCode {
  Success = 0,
  Mismatch = 1,
  Failure = 2,
}

function write(formatterType: FormatterType, patterns: string[]) {
  if (patterns.length === 0) {
    return;
  }

  if (formatterType === 'oxfmt') {
    writeWithOxfmt(patterns);
  } else {
    writeWithPrettier(patterns);
  }
}

function writeWithOxfmt(patterns: string[]) {
  const oxfmtPath = getOxfmtBinPath();
  execFileSync(
    'node',
    [oxfmtPath, ...OXFMT_BASE_ARGS, '--write', ...patterns],
    {
      stdio: [0, 1, 2],
      windowsHide: true,
    }
  );
}

function writeWithPrettier(patterns: string[]) {
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

async function check(
  formatterType: FormatterType,
  patterns: string[]
): Promise<string[]> {
  if (patterns.length === 0) {
    return [];
  }

  if (formatterType === 'oxfmt') {
    return checkWithOxfmt(patterns);
  } else {
    return checkWithPrettier(patterns);
  }
}

function checkWithOxfmt(patterns: string[]): Promise<string[]> {
  const oxfmtPath = getOxfmtBinPath();
  return new Promise((resolve, reject) => {
    execFile(
      'node',
      [oxfmtPath, ...OXFMT_BASE_ARGS, '--list-different', ...patterns],
      {
        encoding: 'utf-8' as const,
        windowsHide: true,
        maxBuffer: FORMATTER_MAX_BUFFER,
      },
      (error, stdout, stderr) => {
        // oxfmt writes the differing paths to stdout *before* it reports any
        // error, so a non-empty stdout does not mean the run succeeded. The
        // exit code is the only reliable signal.
        const code = typeof error?.['code'] === 'number' ? error['code'] : 0;
        if (code === OxfmtExitCode.Success) {
          resolve([]);
        } else if (
          code === OxfmtExitCode.Mismatch &&
          stdout.trim().length > 0
        ) {
          resolve(stdout.trim().split('\n'));
        } else {
          // Exit 1 with no stdout means an invalid config; exit 2 means oxfmt
          // failed outright (parse error, unreadable file).
          reject(
            new Error(
              stderr?.trim() ||
                error?.message ||
                `oxfmt exited with code ${code}`
            )
          );
        }
      }
    );
  });
}

function checkWithPrettier(patterns: string[]): Promise<string[]> {
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

function sortTsConfig() {
  try {
    const tsconfigPath = getRootTsConfigPath();
    const tsconfig = readJsonFile(tsconfigPath);
    const sortedPaths = sortObjectByKeys(tsconfig.compilerOptions.paths);
    tsconfig.compilerOptions.paths = sortedPaths;
    writeJsonFile(tsconfigPath, tsconfig);
  } catch (e) {
    // catch noop
  }
}

let prettierPath: string;

function getPrettierPath() {
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
  prettierPath = path.resolve(path.dirname(packageJsonPath), binPath);

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
