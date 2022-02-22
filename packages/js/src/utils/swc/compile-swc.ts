import { ExecutorContext, logger } from '@nrwl/devkit';
import { cacheDir } from '@nrwl/workspace/src/utilities/cache-directory';
import { exec, execSync } from 'child_process';
import { createAsyncIterable } from '../create-async-iterable/create-async-iteratable';
import { NormalizedSwcExecutorOptions, SwcCliOptions } from '../schema';
import { printDiagnostics } from '../typescript/print-diagnostics';
import { runTypeCheck, TypeCheckOptions } from '../typescript/run-type-check';

function getSwcCmd(
  { swcrcPath, srcPath, destPath }: SwcCliOptions,
  watch = false
) {
  let swcCmd = `npx swc ${srcPath} -d ${destPath} --source-root=${srcPath} --source-maps --no-swcrc --config-file=${swcrcPath}`;
  return watch ? swcCmd.concat(' --watch') : swcCmd;
}

function getTypeCheckOptions(normalizedOptions: NormalizedSwcExecutorOptions) {
  const { projectRoot, watch, tsConfig, root, outputPath } = normalizedOptions;

  const typeCheckOptions: TypeCheckOptions = {
    mode: 'emitDeclarationOnly',
    tsConfigPath: tsConfig,
    outDir: outputPath.replace(`/${projectRoot}`, ''),
    workspaceRoot: root,
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

  const swcCmdLog = execSync(
    getSwcCmd(normalizedOptions.swcCliOptions)
  ).toString();
  logger.log(swcCmdLog.replace(/\n/, ''));
  const isCompileSuccess = swcCmdLog.includes('Successfully compiled');

  await postCompilationCallback();

  if (normalizedOptions.skipTypeCheck) {
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

  return { success: !hasErrors && isCompileSuccess };
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

  return yield* createAsyncIterable<{ success: boolean; outfile: string }>(
    async ({ next, done }) => {
      let processOnExit: () => void;
      let stdoutOnData: () => void;
      let stderrOnData: () => void;
      let watcherOnExit: () => void;

      const swcWatcher = exec(getSwcCmd(normalizedOptions.swcCliOptions, true));

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
