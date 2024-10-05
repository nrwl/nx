import { cacheDir, ExecutorContext, logger } from '@nx/devkit';
import { exec, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { NormalizedSwcExecutorOptions, SwcCliOptions } from '../schema';
import { printDiagnostics } from '../typescript/print-diagnostics';
import { runTypeCheck, TypeCheckOptions } from '../typescript/run-type-check';
import { relative } from 'path';

function getSwcCmd(
  {
    swcCliOptions: { swcrcPath, destPath, stripLeadingPaths },
    root,
    projectRoot,
    originalProjectRoot,
    sourceRoot,
    inline,
  }: NormalizedSwcExecutorOptions,
  watch = false
) {
  const swcCLI = require.resolve('@swc/cli/bin/swc.js');
  let inputDir: string;
  // TODO(v21): remove inline feature
  if (inline) {
    inputDir = originalProjectRoot.split('/')[0];
  } else {
    if (sourceRoot) {
      inputDir = relative(projectRoot, sourceRoot);
    } else {
      // If sourceRoot is not provided, check if `src` exists and use that instead.
      // This is important for root projects to avoid compiling too many directories.
      inputDir = existsSync(join(root, projectRoot, 'src')) ? 'src' : '.';
    }
  }

  let swcCmd = `node ${swcCLI} ${
    inputDir || '.'
  } -d ${destPath} --config-file=${swcrcPath} ${
    stripLeadingPaths ? '--strip-leading-paths' : ''
  }`;
  return watch ? swcCmd.concat(' --watch') : swcCmd;
}

function getTypeCheckOptions(normalizedOptions: NormalizedSwcExecutorOptions) {
  const { sourceRoot, projectRoot, watch, tsConfig, root, outputPath } =
    normalizedOptions;
  const inputDir =
    // If `--strip-leading-paths` SWC option is used, we need to transpile from `src` directory.
    !normalizedOptions.swcCliOptions.stripLeadingPaths
      ? projectRoot
      : sourceRoot
      ? sourceRoot
      : existsSync(join(root, projectRoot, 'src'))
      ? join(projectRoot, 'src')
      : projectRoot;

  const typeCheckOptions: TypeCheckOptions = {
    mode: 'emitDeclarationOnly',
    tsConfigPath: tsConfig,
    outDir: outputPath,
    workspaceRoot: root,
    rootDir: inputDir,
  };

  if (watch) {
    typeCheckOptions.incremental = true;
    typeCheckOptions.cacheDir = cacheDir;
  }

  return typeCheckOptions;
}

export async function compileSwc(
  context: ExecutorContext,
  normalizedOptions: NormalizedSwcExecutorOptions,
  postCompilationCallback: () => Promise<void>
) {
  logger.log(`Compiling with SWC for ${context.projectName}...`);

  if (normalizedOptions.clean) {
    rmSync(normalizedOptions.outputPath, { recursive: true, force: true });
  }

  const swcCmdLog = execSync(getSwcCmd(normalizedOptions), {
    encoding: 'utf8',
    cwd: normalizedOptions.swcCliOptions.swcCwd,
    windowsHide: true,
  });
  logger.log(swcCmdLog.replace(/\n/, ''));
  const isCompileSuccess = swcCmdLog.includes('Successfully compiled');

  if (normalizedOptions.skipTypeCheck) {
    await postCompilationCallback();
    return { success: isCompileSuccess };
  }

  const { errors, warnings } = await runTypeCheck(
    getTypeCheckOptions(normalizedOptions)
  );
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  if (hasErrors || hasWarnings) {
    await printDiagnostics(errors, warnings);
  }

  await postCompilationCallback();
  return {
    success: !hasErrors && isCompileSuccess,
    outfile: normalizedOptions.mainOutputPath,
  };
}

export async function* compileSwcWatch(
  context: ExecutorContext,
  normalizedOptions: NormalizedSwcExecutorOptions,
  postCompilationCallback: () => Promise<void>
) {
  const getResult = (success: boolean) => ({
    success,
    outfile: normalizedOptions.mainOutputPath,
  });

  let typeCheckOptions: TypeCheckOptions;
  let initialPostCompile = true;

  if (normalizedOptions.clean) {
    rmSync(normalizedOptions.outputPath, { recursive: true, force: true });
  }

  return yield* createAsyncIterable<{ success: boolean; outfile: string }>(
    async ({ next, done }) => {
      let processOnExit: () => void;
      let stdoutOnData: () => void;
      let stderrOnData: () => void;
      let watcherOnExit: () => void;

      const swcWatcher = exec(getSwcCmd(normalizedOptions, true), {
        cwd: normalizedOptions.swcCliOptions.swcCwd,
        windowsHide: true,
      });

      processOnExit = () => {
        swcWatcher.kill();
        done();
        process.off('SIGINT', processOnExit);
        process.off('SIGTERM', processOnExit);
        process.off('exit', processOnExit);
      };

      stdoutOnData = async (data?: string) => {
        process.stdout.write(data);
        if (!data.startsWith('Watching')) {
          const swcStatus = data.includes('Successfully');

          if (initialPostCompile) {
            await postCompilationCallback();
            initialPostCompile = false;
          }

          if (normalizedOptions.skipTypeCheck) {
            next(getResult(swcStatus));
            return;
          }

          if (!typeCheckOptions) {
            typeCheckOptions = getTypeCheckOptions(normalizedOptions);
          }

          const delayed = delay(5000);
          next(
            getResult(
              await Promise.race([
                delayed
                  .start()
                  .then(() => ({ tscStatus: false, type: 'timeout' })),
                runTypeCheck(typeCheckOptions).then(({ errors, warnings }) => {
                  const hasErrors = errors.length > 0;
                  if (hasErrors) {
                    printDiagnostics(errors, warnings);
                  }
                  return {
                    tscStatus: !hasErrors,
                    type: 'tsc',
                  };
                }),
              ]).then(({ type, tscStatus }) => {
                if (type === 'tsc') {
                  delayed.cancel();
                  return tscStatus && swcStatus;
                }

                return swcStatus;
              })
            )
          );
        }
      };

      stderrOnData = (err?: any) => {
        process.stderr.write(err);
        if (err.includes('Debugger attached.')) {
          return;
        }
        next(getResult(false));
      };

      watcherOnExit = () => {
        done();
        swcWatcher.off('exit', watcherOnExit);
      };

      swcWatcher.stdout.on('data', stdoutOnData);
      swcWatcher.stderr.on('data', stderrOnData);

      process.on('SIGINT', processOnExit);
      process.on('SIGTERM', processOnExit);
      process.on('exit', processOnExit);

      swcWatcher.on('exit', watcherOnExit);
    }
  );
}

function delay(ms: number): { start: () => Promise<void>; cancel: () => void } {
  let timerId: ReturnType<typeof setTimeout> = undefined;
  return {
    start() {
      return new Promise<void>((resolve) => {
        timerId = setTimeout(() => {
          resolve();
        }, ms);
      });
    },
    cancel() {
      if (timerId) {
        clearTimeout(timerId);
        timerId = undefined;
      }
    },
  };
}
