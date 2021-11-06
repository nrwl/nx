import { getTsConfig } from './get-ts-config';
import { runTsc, TypeCheckResult } from './run-tsc';

export async function runTypeCheck(
  ts: typeof import('typescript'),
  workspaceRoot: string,
  projectRoot: string,
  tsConfigPath: string,
  cacheDir?: string
): Promise<TypeCheckResult> {
  const [parsedCommandLine, compilerOptions] = getTsConfig(
    ts,
    projectRoot,
    tsConfigPath,
    {
      skipLibCheck: true,
      noEmit: true,
    }
  );

  const { totalFilesCount, incremental, errors, warnings } = await runTsc(
    ts,
    compilerOptions,
    parsedCommandLine,
    workspaceRoot,
    cacheDir
  );

  return {
    warnings,
    errors,
    inputFilesCount: parsedCommandLine.fileNames.length,
    totalFilesCount,
    incremental,
  };
}
