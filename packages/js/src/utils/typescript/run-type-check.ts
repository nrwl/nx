import chalk from 'chalk';
import { readFileSync } from 'fs';
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
import {
  codeFrameColumns,
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

export async function runTypeCheckWatch(
  options: TypeCheckOptions,
  callback: (
    diagnostic: Diagnostic,
    formattedDiagnostic: string,
    errorCount?: number
  ) => void | Promise<void>
) {
  const ts = await import('typescript');
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

  return withTypescriptApi(backend, (api) => {
    const snapshot = api.createSnapshot({
      createPrograms: [
        {
          rootFiles: config.fileNames,
          // TypeScript 7.1 parsed the config, and every path option is absolute.
          compilerOptions: apiCompilerOptions as unknown as ApiCompilerOptions,
        },
      ],
    });
    try {
      const [program] = snapshot.operation.createdPrograms;
      const result = program.emit();
      const allDiagnostics = options.ignoreDiagnostics
        ? []
        : getApiPreEmitDiagnostics(program, apiCompilerOptions).concat(
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
    message: flattenApiDiagnosticMessage(diagnostic),
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
    reason: flattenApiDiagnosticMessage(diagnostic),
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

// Matches TypeScript 6's `flattenDiagnosticMessageText(messageText, '\n')`.
function flattenApiDiagnosticMessage(
  diagnostic: ApiDiagnostic,
  indent = 0
): string {
  let result = indent ? '\n' + '  '.repeat(indent) : '';
  result += diagnostic.text;
  for (const child of diagnostic.messageChain ?? []) {
    result += flattenApiDiagnosticMessage(child, indent + 1);
  }
  return result;
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
