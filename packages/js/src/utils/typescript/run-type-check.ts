import * as chalk from 'chalk';
import * as path from 'path';
import type { BuilderProgram, Diagnostic, Program } from 'typescript';
import { codeFrameColumns } from 'nx/src/utils/code-frames';
import { highlight } from '../code-frames/highlight';
import { readTsConfig } from '../../utils/typescript/ts-config';

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
  const { ts, workspaceRoot, config, compilerOptions } = await setupTypeScript(
    options
  );

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
  const { ts, workspaceRoot, cacheDir, config, compilerOptions } =
    await setupTypeScript(options);

  let program: Program | BuilderProgram;
  let incremental = false;
  if (compilerOptions.incremental && cacheDir) {
    incremental = true;
    program = ts.createIncrementalProgram({
      rootNames: config.fileNames,
      options: {
        ...compilerOptions,
        incremental: true,
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
    ts,
    allDiagnostics,
    workspaceRoot,
    config.fileNames.length,
    program.getSourceFiles().length,
    incremental
  );
}

async function setupTypeScript(options: TypeCheckOptions) {
  const ts = await import('typescript');
  const { workspaceRoot, tsConfigPath, cacheDir, incremental, projectRoot } =
    options;
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
      : { noEmit: true };

  const compilerOptions = {
    ...config.options,
    skipLibCheck: true,
    ...emitOptions,
    incremental,
    rootDir: options.rootDir || config.options.rootDir,
  };

  return { ts, workspaceRoot, cacheDir, config, compilerOptions };
}

function getTypeCheckResult(
  ts: typeof import('typescript'),
  allDiagnostics: Diagnostic[],
  workspaceRoot: string,
  inputFilesCount: number,
  totalFilesCount: number,
  incremental: boolean = false
) {
  const errors = allDiagnostics
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => getFormattedDiagnostic(ts, workspaceRoot, d));

  const warnings = allDiagnostics
    .filter((d) => d.category === ts.DiagnosticCategory.Warning)
    .map((d) => getFormattedDiagnostic(ts, workspaceRoot, d));

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
  let message = '';

  const reason = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  const category = diagnostic.category;

  switch (category) {
    case ts.DiagnosticCategory.Warning: {
      message += `${chalk.yellow.bold('warning')} ${chalk.gray(
        `TS${diagnostic.code}`
      )}: `;
      break;
    }
    case ts.DiagnosticCategory.Error: {
      message += `${chalk.red.bold('error')} ${chalk.gray(
        `TS${diagnostic.code}`
      )}: `;
      break;
    }
    case ts.DiagnosticCategory.Suggestion:
    case ts.DiagnosticCategory.Message:
    default: {
      message += `${chalk.cyan.bold(category === 2 ? 'suggestion' : 'info')}: `;
      break;
    }
  }

  message += reason + '\n';

  if (diagnostic.file) {
    const pos = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start!
    );
    const line = pos.line + 1;
    const column = pos.character + 1;
    const fileName = path.relative(workspaceRoot, diagnostic.file.fileName);
    message =
      `${chalk.underline.blue(`${fileName}:${line}:${column}`)} - ` + message;

    const code = diagnostic.file.getFullText(diagnostic.file.getSourceFile());

    message +=
      '\n' +
      codeFrameColumns(
        code,
        {
          start: { line: line, column },
        },
        { highlight }
      );
  }

  return message;
}
