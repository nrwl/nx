import chalk from 'chalk';
import { readFileSync, watch, type FSWatcher } from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import type {
  BuilderProgram,
  CompilerOptions,
  Diagnostic,
  Program,
} from 'typescript';
import type {
  CompilerOptions as ApiCompilerOptions,
  Diagnostic as ApiDiagnostic,
  Program as ApiProgram,
} from 'typescript/sync';
import { highlight } from '../code-frames/highlight';
import { readTsConfig } from '../../utils/typescript/ts-config';
import { isFileSystemCaseSensitive } from './file-system-case';
import {
  codeFrameColumns,
  flattenApiDiagnosticMessage,
  getTypescriptBackend,
  withTypescriptApi,
  type ApiTypescriptBackend,
} from '@nx/devkit/internal';

export interface TypeCheckResult {
  warnings?: string[];
  errors?: string[];
  inputFilesCount: number;
  totalFilesCount: number;
  incremental: boolean;
}

export type TypeCheckOptions = BaseTypeCheckOptions & Mode;

interface BaseTypeCheckOptions {
  workspaceRoot: string;
  tsConfigPath: string;
  cacheDir?: string;
  incremental?: boolean;
  rootDir?: string;
  projectRoot?: string;
  ignoreDiagnostics?: boolean;
}

type Mode = NoEmitMode | EmitDeclarationOnlyMode;

interface NoEmitMode {
  mode: 'noEmit';
}

interface EmitDeclarationOnlyMode {
  mode: 'emitDeclarationOnly';
  outDir: string;
}

type TypeCheckWatchCallback = (
  diagnostic: Diagnostic,
  formattedDiagnostic: string,
  errorCount?: number
) => void | Promise<void>;

interface TypeCheckWatch {
  close: () => void;
  preEmitErrors: string[];
  preEmitWarnings: string[];
}

export async function runTypeCheckWatch(
  options: TypeCheckOptions,
  callback: TypeCheckWatchCallback
): Promise<TypeCheckWatch> {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic':
      return runClassicTypeCheckWatch(backend.ts, options, callback);
    case 'api':
      return runApiTypeCheckWatch(backend, options, callback);
    default: {
      const unhandled: never = backend;
      throw new Error(`Unhandled TypeScript backend: ${unhandled}`);
    }
  }
}

function runClassicTypeCheckWatch(
  ts: typeof import('typescript'),
  options: TypeCheckOptions,
  callback: TypeCheckWatchCallback
): TypeCheckWatch {
  const { workspaceRoot } = options;
  const { config, compilerOptions } = readTypeCheckConfig(options);

  const host = ts.createWatchCompilerHost(
    config.fileNames,
    compilerOptions,
    ts.sys,
    ts.createEmitAndSemanticDiagnosticsBuilderProgram
  );

  const originalOnWatchStatusChange = host.onWatchStatusChange;
  host.onWatchStatusChange = (diagnostic, newLine, opts, errorCount) => {
    originalOnWatchStatusChange?.(diagnostic, newLine, opts, errorCount);
    callback(
      diagnostic,
      getFormattedDiagnostic(ts, workspaceRoot, diagnostic),
      errorCount
    );
  };

  const watchProgram = ts.createWatchProgram(host);
  const program = watchProgram.getProgram().getProgram();
  const diagnostics = options.ignoreDiagnostics
    ? []
    : ts.getPreEmitDiagnostics(program);

  return {
    close: watchProgram.close.bind(watchProgram),
    preEmitErrors: diagnostics
      .filter((d) => d.category === ts.DiagnosticCategory.Error)
      .map((d) => getFormattedDiagnostic(ts, workspaceRoot, d)),
    preEmitWarnings: diagnostics
      .filter((d) => d.category === ts.DiagnosticCategory.Warning)
      .map((d) => getFormattedDiagnostic(ts, workspaceRoot, d)),
  };
}

// TypeScript 6's watch status messages. TypeScript 7.1's API has no watch mode.
const watchStatusMessages = {
  starting: { code: 6031, text: 'Starting compilation in watch mode...' },
  fileChange: {
    code: 6032,
    text: 'File change detected. Starting incremental compilation...',
  },
} as const;

// TypeScript 6 waits this long after the last file change to rebuild.
const watchUpdateDelay = 250;

// Reproduces TypeScript 6's watch program with its default reporters: a fresh
// program per file change, built from the same root files and options.
function runApiTypeCheckWatch(
  backend: ApiTypescriptBackend,
  options: TypeCheckOptions,
  callback: TypeCheckWatchCallback
): TypeCheckWatch {
  const { workspaceRoot } = options;
  const { config, compilerOptions } = readTypeCheckConfig(options);
  const apiCompilerOptions = getApiCompilerOptions(compilerOptions);
  const { DiagnosticCategory, formatDiagnostics } = backend.sync;
  const useCaseSensitiveFileNames = isFileSystemCaseSensitive();
  const formatHost = {
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => EOL,
    getCanonicalFileName: (fileName: string) =>
      useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
  };

  const watchers = new Map<string, FSWatcher>();
  let updateTimer: NodeJS.Timeout | undefined;
  let closed = false;

  const reportStatus = (code: number, text: string, errorCount?: number) => {
    writeWatchStatus(code, text, compilerOptions);
    const diagnostic: ApiDiagnostic = {
      code,
      category: DiagnosticCategory.Message,
      text,
      pos: 0,
      end: 0,
    };
    // The callback gets TypeScript 7.1's diagnostic shape under TypeScript 6's
    // public type.
    callback(
      diagnostic as unknown as Diagnostic,
      getFormattedApiDiagnostic(backend, workspaceRoot, diagnostic),
      errorCount
    );
  };

  const scheduleUpdate = () => {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      updateTimer = undefined;
      if (!closed) {
        update(watchStatusMessages.fileChange);
      }
    }, watchUpdateDelay);
  };

  const watchProgramFiles = (fileNames: readonly string[]) => {
    const current = new Set(fileNames);
    for (const [fileName, watcher] of watchers) {
      if (!current.has(fileName)) {
        watcher.close();
        watchers.delete(fileName);
      }
    }
    for (const fileName of fileNames) {
      if (watchers.has(fileName)) {
        continue;
      }
      let watcher: FSWatcher;
      try {
        watcher = watch(fileName, (event) => {
          // A file replaced by a rename (editors' atomic saves) ends its
          // watcher; the update watches the new file.
          if (event === 'rename') {
            watcher.close();
            watchers.delete(fileName);
          }
          scheduleUpdate();
        });
      } catch (e) {
        // Deleted since the program read it; the next update drops it.
        if (e?.code === 'ENOENT') {
          scheduleUpdate();
          continue;
        }
        throw e;
      }
      watcher.on('error', () => {
        watcher.close();
        watchers.delete(fileName);
        scheduleUpdate();
      });
      watchers.set(fileName, watcher);
    }
  };

  const update = (
    status: (typeof watchStatusMessages)[keyof typeof watchStatusMessages]
  ) =>
    withTypescriptApi(backend, (api) => {
      reportStatus(status.code, status.text);
      const snapshot = api.createSnapshot({
        createPrograms: [
          { rootFiles: config.fileNames, compilerOptions: apiCompilerOptions },
        ],
      });
      try {
        const [program] = snapshot.operation.createdPrograms;
        const diagnostics = emitAndGetWatchDiagnostics(
          program,
          compilerOptions
        );
        for (const diagnostic of diagnostics) {
          process.stdout.write(formatDiagnostics([diagnostic], formatHost));
        }
        const errorCount = diagnostics.filter(
          (d) => d.category === DiagnosticCategory.Error
        ).length;
        reportStatus(
          errorCount === 1 ? 6193 : 6194,
          errorCount === 1
            ? 'Found 1 error. Watching for file changes.'
            : `Found ${errorCount} errors. Watching for file changes.`,
          errorCount
        );
        watchProgramFiles(program.getSourceFileNames());

        return status === watchStatusMessages.starting &&
          !options.ignoreDiagnostics
          ? getApiPreEmitDiagnostics(program, compilerOptions)
          : [];
      } finally {
        snapshot.dispose();
      }
    });

  const close = () => {
    closed = true;
    clearTimeout(updateTimer);
    for (const watcher of watchers.values()) {
      watcher.close();
    }
    watchers.clear();
  };

  let diagnostics: ApiDiagnostic[];
  try {
    diagnostics = update(watchStatusMessages.starting);
  } catch (e) {
    close();
    throw e;
  }
  const format = (diagnostic: ApiDiagnostic) =>
    getFormattedApiDiagnostic(backend, workspaceRoot, diagnostic);

  return {
    close,
    preEmitErrors: diagnostics
      .filter((d) => d.category === DiagnosticCategory.Error)
      .map(format),
    preEmitWarnings: diagnostics
      .filter((d) => d.category === DiagnosticCategory.Warning)
      .map(format),
  };
}

// TypeScript 6's default, non-pretty watch status reporter.
function writeWatchStatus(
  code: number,
  text: string,
  compilerOptions: CompilerOptions
) {
  const newLine = compilerOptions.newLine === 0 ? '\r\n' : '\n';
  const startsScreen =
    code === watchStatusMessages.starting.code ||
    code === watchStatusMessages.fileChange.code;
  let output = '';
  if (
    startsScreen &&
    !compilerOptions.preserveWatchOutput &&
    !compilerOptions.extendedDiagnostics &&
    !compilerOptions.diagnostics
  ) {
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
  } else {
    output += newLine;
  }
  output += `${new Date().toLocaleTimeString()} - ${text}`;
  output += startsScreen ? newLine + newLine : newLine;
  process.stdout.write(output);
}

// Mirrors TypeScript 6's `emitFilesAndReportErrors`: semantic diagnostics only
// when there are no syntactic, option or global ones.
function emitAndGetWatchDiagnostics(
  program: ApiProgram,
  compilerOptions: CompilerOptions
): ApiDiagnostic[] {
  const diagnostics = [...program.getConfigFileParsingDiagnostics()];
  const configDiagnosticsCount = diagnostics.length;
  diagnostics.push(...program.getSyntacticDiagnostics());
  if (diagnostics.length === configDiagnosticsCount) {
    diagnostics.push(
      ...program.getProgramDiagnostics(),
      ...program.getGlobalDiagnostics()
    );
    if (diagnostics.length === configDiagnosticsCount) {
      diagnostics.push(...program.getSemanticDiagnostics());
    }
    if (
      compilerOptions.noEmit &&
      (compilerOptions.declaration || compilerOptions.composite) &&
      diagnostics.length === configDiagnosticsCount
    ) {
      diagnostics.push(...program.getDeclarationDiagnostics());
    }
  }
  diagnostics.push(...program.emit().diagnostics);
  return sortAndDeduplicateApiDiagnostics(diagnostics);
}

export async function runTypeCheck(
  options: TypeCheckOptions
): Promise<TypeCheckResult> {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic':
      return runClassicTypeCheck(backend.ts, options);
    case 'api':
      return runApiTypeCheck(backend, options);
    default: {
      const unhandled: never = backend;
      throw new Error(`Unhandled TypeScript backend: ${unhandled}`);
    }
  }
}

function runClassicTypeCheck(
  ts: typeof import('typescript'),
  options: TypeCheckOptions
): TypeCheckResult {
  const { workspaceRoot, cacheDir } = options;
  const { config, compilerOptions } = readTypeCheckConfig(options);

  let program: Program | BuilderProgram;
  let incremental = false;
  if (compilerOptions.incremental && cacheDir) {
    incremental = true;
    program = ts.createIncrementalProgram({
      rootNames: config.fileNames,
      options: {
        ...compilerOptions,
        incremental: true,
        // Set after the spread so it overrides any user-set tsBuildInfoFile.
        // This is a dedicated type-check program with Nx-injected options that
        // differ from the real build, so its build info must not share a file
        // with the build, or it corrupts the build's incremental cache.
        tsBuildInfoFile: path.join(cacheDir, '.tsbuildinfo'),
      },
    });
  } else {
    program = ts.createProgram(config.fileNames, compilerOptions);
  }

  const result = program.emit();

  const allDiagnostics = options.ignoreDiagnostics
    ? []
    : ts.getPreEmitDiagnostics(program as Program).concat(result.diagnostics);

  return getTypeCheckResult(
    ts.DiagnosticCategory,
    allDiagnostics,
    (diagnostic) => getFormattedDiagnostic(ts, workspaceRoot, diagnostic),
    config.fileNames.length,
    program.getSourceFiles().length,
    incremental
  );
}

function runApiTypeCheck(
  backend: ApiTypescriptBackend,
  options: TypeCheckOptions
): TypeCheckResult {
  const { config, compilerOptions } = readTypeCheckConfig(options);
  const apiCompilerOptions = getApiCompilerOptions(compilerOptions);

  return withTypescriptApi(backend, (api) => {
    const snapshot = api.createSnapshot({
      createPrograms: [
        { rootFiles: config.fileNames, compilerOptions: apiCompilerOptions },
      ],
    });
    try {
      const [program] = snapshot.operation.createdPrograms;
      const result = program.emit();
      const allDiagnostics = options.ignoreDiagnostics
        ? []
        : getApiPreEmitDiagnostics(program, compilerOptions).concat(
            result.diagnostics
          );

      return getTypeCheckResult(
        backend.sync.DiagnosticCategory,
        allDiagnostics,
        (diagnostic) =>
          getFormattedApiDiagnostic(backend, options.workspaceRoot, diagnostic),
        config.fileNames.length,
        program.getSourceFileNames().length,
        false
      );
    } finally {
      snapshot.dispose();
    }
  });
}

function getApiCompilerOptions(
  compilerOptions: CompilerOptions
): ApiCompilerOptions {
  const apiCompilerOptions: CompilerOptions = {
    ...compilerOptions,
    // TypeScript 7.1 resolves relative paths against the workspace root,
    // TypeScript 6 against the cwd.
    outDir: resolveIfDefined(compilerOptions.outDir),
    declarationDir: resolveIfDefined(compilerOptions.declarationDir),
    rootDir: resolveIfDefined(compilerOptions.rootDir),
    // TypeScript 7.1 programs write no build info.
    incremental: undefined,
  };
  // TypeScript 7.1 parsed the config, and every path option is now absolute.
  return apiCompilerOptions as unknown as ApiCompilerOptions;
}

function resolveIfDefined(filePath: string | undefined) {
  return filePath === undefined ? undefined : path.resolve(filePath);
}

// Mirrors TypeScript 6's `getPreEmitDiagnostics`. TypeScript 7.1's global
// diagnostics repeat its program diagnostics, which the dedupe drops.
function getApiPreEmitDiagnostics(
  program: ApiProgram,
  compilerOptions: CompilerOptions
): ApiDiagnostic[] {
  const diagnostics = [
    ...program.getConfigFileParsingDiagnostics(),
    ...program.getProgramDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSemanticDiagnostics(),
    ...(compilerOptions.declaration || compilerOptions.composite
      ? program.getDeclarationDiagnostics()
      : []),
  ];
  return sortAndDeduplicateApiDiagnostics(diagnostics);
}

// Same order and equality as TypeScript 6's `sortAndDeduplicateDiagnostics`:
// file, start, length, code, then message.
function sortAndDeduplicateApiDiagnostics(
  diagnostics: ApiDiagnostic[]
): ApiDiagnostic[] {
  const entries = diagnostics.map((diagnostic) => ({
    diagnostic,
    message: flattenApiDiagnosticMessage(diagnostic, '\n'),
  }));
  const compare = (a: (typeof entries)[number], b: (typeof entries)[number]) =>
    compareStrings(a.diagnostic.fileName, b.diagnostic.fileName) ||
    a.diagnostic.pos - b.diagnostic.pos ||
    a.diagnostic.end -
      a.diagnostic.pos -
      (b.diagnostic.end - b.diagnostic.pos) ||
    a.diagnostic.code - b.diagnostic.code ||
    compareStrings(a.message, b.message);

  entries.sort(compare);
  return entries
    .filter((entry, i) => i === 0 || compare(entries[i - 1], entry) !== 0)
    .map(({ diagnostic }) => diagnostic);
}

function compareStrings(a: string | undefined, b: string | undefined) {
  if (a === b) {
    return 0;
  }
  if (a === undefined) {
    return -1;
  }
  if (b === undefined) {
    return 1;
  }
  return a < b ? -1 : 1;
}

function readTypeCheckConfig(options: TypeCheckOptions) {
  const { tsConfigPath, incremental, projectRoot } = options;
  const config = readTsConfig(tsConfigPath);
  if (config.errors.length) {
    const errorMessages = config.errors.map((e) => e.messageText).join('\n');
    throw new Error(`Invalid config file due to following: ${errorMessages}`);
  }

  const emitOptions =
    options.mode === 'emitDeclarationOnly'
      ? {
          emitDeclarationOnly: true,
          declaration: true,
          outDir: options.outDir,
          declarationDir:
            options.projectRoot && options.outDir.indexOf(projectRoot)
              ? options.outDir.replace(projectRoot, '')
              : undefined,
        }
      : { noEmit: true, composite: false };

  const compilerOptions: CompilerOptions = {
    ...config.options,
    skipLibCheck: true,
    ...emitOptions,
    incremental,
    rootDir: options.rootDir || config.options.rootDir,
  };

  return { config, compilerOptions };
}

type DiagnosticCategories = {
  Warning: number;
  Error: number;
  Suggestion: number;
  Message: number;
};

function getTypeCheckResult<D extends { category: number }>(
  categories: DiagnosticCategories,
  allDiagnostics: D[],
  format: (diagnostic: D) => string,
  inputFilesCount: number,
  totalFilesCount: number,
  incremental: boolean = false
) {
  const errors = allDiagnostics
    .filter((d) => d.category === categories.Error)
    .map(format);

  const warnings = allDiagnostics
    .filter((d) => d.category === categories.Warning)
    .map(format);

  return {
    warnings,
    errors,
    inputFilesCount,
    totalFilesCount,
    incremental,
  };
}

export function getFormattedDiagnostic(
  ts: typeof import('typescript'),
  workspaceRoot: string,
  diagnostic: Diagnostic
): string {
  let location: DiagnosticLocation | undefined;
  if (diagnostic.file) {
    const pos = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start!
    );
    location = {
      fileName: diagnostic.file.fileName,
      line: pos.line + 1,
      column: pos.character + 1,
      fileText: diagnostic.file.getFullText(diagnostic.file.getSourceFile()),
    };
  }

  return formatDiagnostic(ts.DiagnosticCategory, workspaceRoot, {
    category: diagnostic.category,
    code: diagnostic.code,
    reason: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    location,
  });
}

function getFormattedApiDiagnostic(
  backend: ApiTypescriptBackend,
  workspaceRoot: string,
  diagnostic: ApiDiagnostic
): string {
  const { fileName, startPosition } = diagnostic;
  return formatDiagnostic(backend.sync.DiagnosticCategory, workspaceRoot, {
    category: diagnostic.category,
    code: diagnostic.code,
    reason: flattenApiDiagnosticMessage(diagnostic, '\n'),
    location:
      fileName && startPosition
        ? {
            fileName,
            line: startPosition.line + 1,
            column: startPosition.character + 1,
            // TypeScript drops the byte order mark when it reads a file.
            fileText: readFileSync(fileName, 'utf-8').replace(/^\uFEFF/, ''),
          }
        : undefined,
  });
}

interface DiagnosticLocation {
  fileName: string;
  line: number;
  column: number;
  fileText: string;
}

function formatDiagnostic(
  categories: DiagnosticCategories,
  workspaceRoot: string,
  diagnostic: {
    category: number;
    code: number;
    reason: string;
    location: DiagnosticLocation | undefined;
  }
): string {
  let message = '';

  const { category, reason, location } = diagnostic;

  switch (category) {
    case categories.Warning: {
      message += `${chalk.yellow.bold('warning')} ${chalk.gray(
        `TS${diagnostic.code}`
      )}: `;
      break;
    }
    case categories.Error: {
      message += `${chalk.red.bold('error')} ${chalk.gray(
        `TS${diagnostic.code}`
      )}: `;
      break;
    }
    case categories.Suggestion:
    case categories.Message:
    default: {
      message += `${chalk.cyan.bold(
        category === categories.Suggestion ? 'suggestion' : 'info'
      )}: `;
      break;
    }
  }

  message += reason + '\n';

  if (location) {
    const { line, column } = location;
    const fileName = path.relative(workspaceRoot, location.fileName);
    message =
      `${chalk.underline.blue(`${fileName}:${line}:${column}`)} - ` + message;

    message +=
      '\n' +
      codeFrameColumns(
        location.fileText,
        {
          start: { line: line, column },
        },
        { highlight }
      );
  }

  return message;
}
