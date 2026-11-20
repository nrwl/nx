import { joinPathFragments, logger } from '@nx/devkit';
import {
  getTypescriptBackend,
  requireClassicTypescript,
  unhandledTypescriptBackend,
  type ApiTypescriptBackend,
} from '@nx/devkit/internal';
import { spawn, spawnSync } from 'child_process';
import { rmSync } from 'fs';
import { EOL } from 'os';
import type * as ts from 'typescript';
import type { CustomTransformers, Diagnostic, Program } from 'typescript';
import {
  getTscCliPath,
  parseTscWatchStatus,
  stripTscErrorSummary,
} from './tsc-cli';
import { readTsConfig } from './ts-config';

export interface TypeScriptCompilationOptions {
  outputPath: string;
  projectName: string;
  projectRoot: string;
  tsConfig: string;
  deleteOutputPath?: boolean;
  rootDir?: string;
  watch?: boolean;
  getCustomTransformers?(program: Program): CustomTransformers;
}

export interface TypescriptWatchChangeEvent {
  diagnostic: ts.Diagnostic;
  newLine: string;
  options: ts.CompilerOptions;
  errorCount: number;
}

export function compileTypeScript(options: TypeScriptCompilationOptions): {
  success: boolean;
} {
  const normalizedOptions = normalizeOptions(options);
  const tsConfig = getNormalizedTsConfig(normalizedOptions);
  const backend = getCompilationBackend(normalizedOptions);

  if (normalizedOptions.deleteOutputPath) {
    rmSync(normalizedOptions.outputPath, { recursive: true, force: true });
  }

  switch (backend.kind) {
    case 'classic':
      return createProgram(backend.ts, tsConfig, normalizedOptions);
    case 'api':
      return compileWithTscCli(backend, tsConfig, normalizedOptions);
    default:
      return unhandledTypescriptBackend(backend);
  }
}

export function compileTypeScriptWatcher(
  options: TypeScriptCompilationOptions,
  callback: (
    diagnostic: Diagnostic,
    newLine: string,
    options: ts.CompilerOptions,
    errorCount: number
  ) => void | Promise<void>
): { close(): void } {
  const normalizedOptions = normalizeOptions(options);
  const tsConfig = getNormalizedTsConfig(normalizedOptions);
  const backend = getCompilationBackend(normalizedOptions);

  if (normalizedOptions.deleteOutputPath) {
    rmSync(normalizedOptions.outputPath, { recursive: true, force: true });
  }

  switch (backend.kind) {
    case 'classic':
      return watchWithClassicProgram(backend.ts, tsConfig, options, callback);
    case 'api':
      return watchWithTscCli(backend, tsConfig, normalizedOptions, callback);
    default:
      return unhandledTypescriptBackend(backend);
  }
}

function watchWithClassicProgram(
  tsModule: typeof ts,
  tsConfig: ts.ParsedCommandLine,
  options: TypeScriptCompilationOptions,
  callback: Parameters<typeof compileTypeScriptWatcher>[1]
) {
  const host = tsModule.createWatchCompilerHost(
    tsConfig.fileNames,
    tsConfig.options,
    tsModule.sys
  );

  const originalAfterProgramCreate = host.afterProgramCreate;
  host.afterProgramCreate = (builderProgram) => {
    const originalProgramEmit = builderProgram.emit;
    builderProgram.emit = (
      targetSourceFile,
      writeFile,
      cancellationToken,
      emitOnlyDtsFiles,
      customTransformers
    ) => {
      const consumerCustomTransformers = options.getCustomTransformers?.(
        builderProgram.getProgram()
      );

      const mergedCustomTransformers = mergeCustomTransformers(
        customTransformers,
        consumerCustomTransformers
      );

      return originalProgramEmit(
        targetSourceFile,
        writeFile,
        cancellationToken,
        emitOnlyDtsFiles,
        mergedCustomTransformers
      );
    };

    if (originalAfterProgramCreate) originalAfterProgramCreate(builderProgram);
  };

  const originalOnWatchStatusChange = host.onWatchStatusChange;
  host.onWatchStatusChange = async (a, b, c, d) => {
    originalOnWatchStatusChange?.(a, b, c, d);
    await callback?.(a, b, c, d);
  };

  return tsModule.createWatchProgram(host);
}

function mergeCustomTransformers(
  originalCustomTransformers: CustomTransformers | undefined,
  consumerCustomTransformers: CustomTransformers | undefined
): CustomTransformers | undefined {
  if (!consumerCustomTransformers) return originalCustomTransformers;

  const mergedCustomTransformers: CustomTransformers = {};
  if (consumerCustomTransformers.before) {
    mergedCustomTransformers.before = originalCustomTransformers?.before
      ? [
          ...originalCustomTransformers.before,
          ...consumerCustomTransformers.before,
        ]
      : consumerCustomTransformers.before;
  }

  if (consumerCustomTransformers.after) {
    mergedCustomTransformers.after = originalCustomTransformers?.after
      ? [
          ...originalCustomTransformers.after,
          ...consumerCustomTransformers.after,
        ]
      : consumerCustomTransformers.after;
  }

  if (consumerCustomTransformers.afterDeclarations) {
    mergedCustomTransformers.afterDeclarations =
      originalCustomTransformers?.afterDeclarations
        ? [
            ...originalCustomTransformers.afterDeclarations,
            ...consumerCustomTransformers.afterDeclarations,
          ]
        : consumerCustomTransformers.afterDeclarations;
  }

  return mergedCustomTransformers;
}

function getNormalizedTsConfig(options: TypeScriptCompilationOptions) {
  const tsConfig = readTsConfig(options.tsConfig);
  tsConfig.options.outDir = options.outputPath;
  tsConfig.options.noEmitOnError = true;
  tsConfig.options.rootDir = options.rootDir;
  if (tsConfig.options.incremental && !tsConfig.options.tsBuildInfoFile) {
    tsConfig.options.tsBuildInfoFile = joinPathFragments(
      options.outputPath,
      'tsconfig.tsbuildinfo'
    );
  }
  return tsConfig;
}

function createProgram(
  tsModule: typeof ts,
  tsconfig: ts.ParsedCommandLine,
  { projectName, getCustomTransformers }: TypeScriptCompilationOptions
): { success: boolean } {
  const host = tsModule.createCompilerHost(tsconfig.options);
  const program = tsModule.createProgram({
    rootNames: tsconfig.fileNames,
    options: tsconfig.options,
    host,
  });
  logger.info(`Compiling TypeScript files for project "${projectName}"...`);
  const results = program.emit(
    undefined,
    undefined,
    undefined,
    undefined,
    getCustomTransformers?.(program)
  );
  if (results.emitSkipped) {
    const diagnostics = tsModule.formatDiagnosticsWithColorAndContext(
      results.diagnostics,
      {
        getCurrentDirectory: () => tsModule.sys.getCurrentDirectory(),
        getNewLine: () => tsModule.sys.newLine,
        getCanonicalFileName: (name) => name,
      }
    );
    logger.error(diagnostics);
    return { success: false };
  } else {
    logger.info(
      `Done compiling TypeScript files for project "${projectName}".`
    );
    return { success: true };
  }
}

// TypeScript 7.1 has no compiler API for custom transformers.
function getCompilationBackend({
  projectName,
  getCustomTransformers,
}: TypeScriptCompilationOptions) {
  if (getCustomTransformers) {
    requireClassicTypescript(
      `Compiling project "${projectName}" with custom TypeScript transformers`
    );
  }
  return getTypescriptBackend();
}

function compileWithTscCli(
  backend: ApiTypescriptBackend,
  tsConfig: ts.ParsedCommandLine,
  { projectName, tsConfig: tsConfigPath }: TypeScriptCompilationOptions
): { success: boolean } {
  logger.info(`Compiling TypeScript files for project "${projectName}"...`);
  const result = spawnSync(
    process.execPath,
    [
      getTscCliPath(backend),
      ...getTscCliArgs(tsConfigPath, tsConfig.options),
      '--pretty',
    ],
    {
      encoding: 'utf8',
      maxBuffer: Infinity,
      stdio: ['ignore', 'pipe', 'inherit'],
      windowsHide: true,
    }
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    logger.error(stripTscErrorSummary(result.stdout));
    return { success: false };
  }
  logger.info(`Done compiling TypeScript files for project "${projectName}".`);
  return { success: true };
}

function watchWithTscCli(
  backend: ApiTypescriptBackend,
  tsConfig: ts.ParsedCommandLine,
  { tsConfig: tsConfigPath }: TypeScriptCompilationOptions,
  callback: Parameters<typeof compileTypeScriptWatcher>[1]
): { close(): void } {
  const args = [
    getTscCliPath(backend),
    ...getTscCliArgs(tsConfigPath, tsConfig.options),
    '--watch',
  ];
  // TypeScript 6 picks the pretty reporter for a terminal, and `tsc` would
  // only see the pipe.
  if (tsConfig.options.pretty === undefined && process.stdout.isTTY) {
    args.push('--pretty');
  }
  const child = spawn(process.execPath, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    windowsHide: true,
  });
  let closed = false;
  const kill = () => child.kill();
  process.on('exit', kill);
  child.on('exit', (code, signal) => {
    process.off('exit', kill);
    // `tsc` exits with 0 on SIGINT and SIGTERM, as when the task is stopped.
    if (!closed && code !== 0) {
      throw new Error(
        `The TypeScript compiler stopped watching (${signal ?? `exit code ${code}`}).`
      );
    }
  });

  let partialLine = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    process.stdout.write(chunk);
    const lines = (partialLine + chunk).split('\n');
    partialLine = lines.pop();
    for (const line of lines) {
      const status = parseTscWatchStatus(line);
      if (status) {
        const diagnostic = {
          category: backend.sync.DiagnosticCategory.Message,
          code: status.code,
          file: undefined,
          start: undefined,
          length: undefined,
          messageText: status.text,
        } as Diagnostic;
        void callback(diagnostic, EOL, tsConfig.options, status.errorCount);
      }
    }
  });

  return {
    close() {
      closed = true;
      process.off('exit', kill);
      child.kill();
    },
  };
}

// `getNormalizedTsConfig`'s overrides as `tsc` flags. The status lines and
// summary parsed from the output are English only.
function getTscCliArgs(
  tsConfigPath: string,
  { outDir, rootDir, tsBuildInfoFile }: ts.CompilerOptions
): string[] {
  return [
    '-p',
    tsConfigPath,
    '--outDir',
    outDir,
    '--rootDir',
    rootDir,
    '--noEmitOnError',
    ...(tsBuildInfoFile ? ['--tsBuildInfoFile', tsBuildInfoFile] : []),
    '--locale',
    'en',
  ];
}

function normalizeOptions(
  options: TypeScriptCompilationOptions
): TypeScriptCompilationOptions {
  return {
    ...options,
    deleteOutputPath: options.deleteOutputPath ?? true,
    rootDir: options.rootDir ?? options.projectRoot,
  };
}
