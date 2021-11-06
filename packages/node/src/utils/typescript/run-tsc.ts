import * as path from 'path';
import { getFormattedDiagnostic } from './get-formatted-diagnostic';
import type {
  CompilerOptions,
  EmitResult,
  ParsedCommandLine,
} from 'typescript';

export interface TypeCheckResult {
  warnings?: string[];
  errors?: string[];
  inputFilesCount: number;
  totalFilesCount: number;
  incremental: boolean;
  result?: EmitResult;
}

export async function runTsc(
  ts: typeof import('typescript'),
  compilerOptions: CompilerOptions,
  parsedCommandLine: ParsedCommandLine,
  workspaceRoot: string,
  cacheDir?: string
): Promise<Omit<TypeCheckResult, 'inputFilesCount'>> {
  let program:
    | import('typescript').Program
    | import('typescript').BuilderProgram;
  let incremental = false;
  if (compilerOptions.incremental && cacheDir) {
    incremental = true;
    program = ts.createIncrementalProgram({
      rootNames: parsedCommandLine.fileNames,
      options: {
        ...compilerOptions,
        incremental: true,
        tsBuildInfoFile: path.join(cacheDir, '.tsbuildinfo'),
      },
    });
  } else {
    program = ts.createProgram(parsedCommandLine.fileNames, compilerOptions);
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
    totalFilesCount: program.getSourceFiles().length,
    incremental,
    errors,
    warnings,
    result,
  };
}
