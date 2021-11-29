import * as path from 'path';
import * as ts from 'typescript';
import { existsSync, readFileSync } from 'fs';
import * as chalk from 'chalk';
import { codeFrameColumns } from '../code-frames/code-frames';

export interface TypeCheckResult {
  warnings?: string[];
  errors?: string[];
  inputFilesCount: number;
  totalFilesCount: number;
  incremental: boolean;
}

type TypeCheckOptions = BaseTypeCheckOptions & Mode;

interface BaseTypeCheckOptions {
  ts: typeof import('typescript');
  workspaceRoot: string;
  projectRoot: string;
  tsConfigPath: string;
  cacheDir?: string;
}

type Mode = NoEmitMode | EmitDeclarationOnlyMode;

interface NoEmitMode {
  mode: 'noEmit';
}

interface EmitDeclarationOnlyMode {
  mode: 'emitDeclarationOnly';
  outDir: string;
}

export async function runTypeCheck(
  options: TypeCheckOptions
): Promise<TypeCheckResult> {
  const { ts, workspaceRoot, projectRoot, tsConfigPath, cacheDir } = options;
  const config = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(`Invalid config file: ${config.error}`);
  }

  const parseConfigHost: ts.ParseConfigHost = {
    fileExists: existsSync,
    readDirectory: ts.sys.readDirectory,
    readFile: (file) => readFileSync(file, 'utf8'),
    useCaseSensitiveFileNames: true,
  };
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    parseConfigHost,
    path.resolve(projectRoot),
    options.mode === 'emitDeclarationOnly'
      ? { emitDeclarationOnly: true, declaration: true, outDir: options.outDir }
      : { noEmit: true }
  );

  const compilerOptions = { ...parsed.options, skipLibCheck: true };

  let program:
    | import('typescript').Program
    | import('typescript').BuilderProgram;
  let incremental = false;
  if (compilerOptions.incremental && cacheDir) {
    incremental = true;
    program = ts.createIncrementalProgram({
      rootNames: parsed.fileNames,
      options: {
        ...compilerOptions,
        incremental: true,
        tsBuildInfoFile: path.join(cacheDir, '.tsbuildinfo'),
      },
    });
  } else {
    program = ts.createProgram(parsed.fileNames, compilerOptions);
  }
  const result = program.emit();

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program as import('typescript').Program)
    .concat(result.diagnostics);

  const errors = await Promise.all(
    allDiagnostics
      .filter((d) => d.category === ts.DiagnosticCategory.Error)
      .map((d) => getFormattedDiagnostic(ts, workspaceRoot, d))
  );

  const warnings = await Promise.all(
    allDiagnostics
      .filter((d) => d.category === ts.DiagnosticCategory.Warning)
      .map((d) => getFormattedDiagnostic(ts, workspaceRoot, d))
  );

  return {
    warnings,
    errors,
    inputFilesCount: parsed.fileNames.length,
    totalFilesCount: program.getSourceFiles().length,
    incremental,
  };
}

export async function getFormattedDiagnostic(
  ts: typeof import('typescript'),
  workspaceRoot: string,
  diagnostic: import('typescript').Diagnostic
): Promise<string> {
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

    message +=
      '\n' +
      codeFrameColumns(
        diagnostic.file.getFullText(diagnostic.file.getSourceFile()),
        {
          start: { line: line, column },
        }
      );
  }

  return message;
}
