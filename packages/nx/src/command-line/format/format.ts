import * as path from 'node:path';
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
import { detectFormatter, type FormatterType } from '../../utils/formatters';
import {
  checkWithOxfmt,
  getOxfmtBinPath,
  writeWithOxfmt,
} from '../../utils/formatters/oxfmt';
import {
  checkWithPrettier,
  filterToPrettierSupportedFiles,
  getPrettierPath,
  quoteForShell,
  writeWithPrettier,
} from '../../utils/formatters/prettier';
import { getIgnoreObject } from '../../utils/ignore';
import { sortObjectByKeys } from '../../utils/object-sort';
import { output } from '../../utils/output';
import { workspaceRoot } from '../../utils/workspace-root';

/**
 * A table, not a `switch`: this lookup sits inside a `try` whose `catch`
 * reports "configured but not installed", and a `never` arm would throw into
 * that catch and be misreported. A missing member is a compile error here.
 */
const resolveFormatterBin = {
  oxfmt: getOxfmtBinPath,
  prettier: getPrettierPath,
} satisfies Record<FormatterType, () => string>;

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

  // Detection reads configuration only, so a workspace can be configured for a
  // formatter that is not installed - a fresh clone, `--omit=dev` CI, a pruned
  // node_modules. Resolving now turns a raw MODULE_NOT_FOUND into something
  // actionable.
  try {
    resolveFormatterBin[formatterType]();
  } catch {
    output.error({
      title: `${formatterType} is configured for this workspace but is not installed.`,
      bodyLines: [
        `Install "${formatterType}" and try again, or remove its configuration to disable "nx format:${command}".`,
      ],
    });
    process.exit(1);
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

  // Chunkify the patterns array to prevent crashing the windows terminal.
  // The prettier path quotes each pattern on its way to the shell, so size the
  // chunks against that; oxfmt goes through execFile and gets them raw.
  const chunkList: string[][] = chunkify(
    patterns,
    undefined,
    formatterType === 'prettier'
      ? (pattern) => quoteForShell(pattern).length
      : undefined
  );

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
      // does not handle, and its base args keep an all-skipped run green.
      patterns = await filterToPrettierSupportedFiles(patterns);
    }

    // exclude patterns in .nxignore or .gitignore
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

function write(formatterType: FormatterType, patterns: string[]): void {
  if (patterns.length === 0) {
    return;
  }

  switch (formatterType) {
    case 'oxfmt':
      writeWithOxfmt(patterns);
      break;
    case 'prettier':
      writeWithPrettier(patterns);
      break;
    default: {
      // Without this, an unhandled formatter makes `nx format:write` exit 0
      // having formatted nothing, while `check()` throws - the two halves of
      // the same command disagreeing.
      const unhandled: never = formatterType;
      throw new Error(`Unhandled formatter: ${unhandled}`);
    }
  }
}

async function check(
  formatterType: FormatterType,
  patterns: string[]
): Promise<string[]> {
  if (patterns.length === 0) {
    return [];
  }

  switch (formatterType) {
    case 'oxfmt':
      return checkWithOxfmt(patterns);
    case 'prettier':
      return checkWithPrettier(patterns);
    default: {
      // `strict: false` does not make a missing case an error on its own, but
      // it does reject this assignment - so adding a formatter fails to compile
      // here instead of returning undefined into a caller that spreads it.
      const unhandled: never = formatterType;
      throw new Error(`Unhandled formatter: ${unhandled}`);
    }
  }
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
