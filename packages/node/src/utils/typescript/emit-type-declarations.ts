import { getTsConfig } from './get-ts-config';
import { runTsc } from './run-tsc';

export async function emitTypeDeclarations(
  ts: typeof import('typescript'),
  workspaceRoot: string,
  projectRoot: string,
  tsConfigPath: string,
  outDir: string,
  cacheDir?: string
) {
  const [parsedCommandLine, compilerOptions] = getTsConfig(
    ts,
    projectRoot,
    tsConfigPath,
    {
      emitDeclarationOnly: true,
      declaration: true,
      outDir,
    }
  );

  const { result, errors, warnings, totalFilesCount, incremental } =
    await runTsc(
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
    result,
  };
}
