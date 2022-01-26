import { ExecutorContext, logger } from '@nrwl/devkit';
import { cacheDir } from '@nrwl/workspace/src/utilities/cache-directory';
import { exec, execSync } from 'child_process';
import { NormalizedSwcExecutorOptions } from '../schema';
import { printDiagnostics } from '../typescript/print-diagnostics';
import { runTypeCheck, TypeCheckOptions } from '../typescript/run-type-check';

function getSwcCmd(
  normalizedOptions: NormalizedSwcExecutorOptions,
  watch = false
) {
  const srcPath = `../${normalizedOptions.swcCliOptions.projectDir}`;
  let swcCmd = `npx swc ${srcPath} -d ${normalizedOptions.swcCliOptions.destPath} --source-maps --no-swcrc --config-file=${normalizedOptions.swcrcPath}`;
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

  const swcCmdLog = execSync(getSwcCmd(normalizedOptions), {
    cwd: normalizedOptions.projectRoot,
  }).toString();
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
  logger.log(
    `Compiling with SWC for ${context.projectName}.....................`
  );

  const getResult = (success: boolean) => ({
    success,
    outfile: normalizedOptions.mainOutputPath,
  });

  const swcWatcher = exec(getSwcCmd(normalizedOptions, true), {
    cwd: normalizedOptions.projectRoot,
  });

  const promisifySwcWatcher = () => {
    let processOnExit: () => void;
    let stdoutOnData: () => void;
    let stderrOnData: () => void;
    let watcherOnExit: () => void;

    return new Promise<{
      success: boolean;
      timestamp: number;
      exit: boolean;
    }>((resolve) => {
      processOnExit = () => {
        swcWatcher.kill();
        resolve({ success: true, exit: true, timestamp: Date.now() });
      };

      stdoutOnData = (data?: any) => {
        process.stdout.write(data);
        if (!data.startsWith('Watching')) {
          resolve({
            success: data.includes('Successfully'),
            exit: false,
            timestamp: Date.now(),
          });
        }
      };

      stderrOnData = (err?: any) => {
        process.stderr.write(err);
        resolve({ success: false, exit: false, timestamp: Date.now() });
      };

      watcherOnExit = () => {
        resolve({ success: true, exit: true, timestamp: Date.now() });
      };

      swcWatcher.stdout.on('data', stdoutOnData);
      swcWatcher.stderr.on('data', stderrOnData);

      process.on('SIGINT', processOnExit);
      process.on('SIGTERM', processOnExit);
      process.on('exit', processOnExit);

      swcWatcher.on('exit', watcherOnExit);
    }).finally(() => {
      if (processOnExit) {
        process.off('SIGINT', processOnExit);
        process.off('SIGTERM', processOnExit);
        process.off('exit', processOnExit);
      }

      if (stdoutOnData) {
        swcWatcher.stdout.off('data', stdoutOnData);
      }

      if (stderrOnData) {
        swcWatcher.stderr.off('data', stderrOnData);
      }

      if (watcherOnExit) {
        swcWatcher.off('exit', watcherOnExit);
      }
    });
  };

  let typeCheckOptions: TypeCheckOptions;

  // initial
  const { success: initialSwcStatus } = await promisifySwcWatcher();

  await postCompilationCallback();

  if (normalizedOptions.skipTypeCheck) {
    yield getResult(initialSwcStatus);
  } else {
    typeCheckOptions = getTypeCheckOptions(normalizedOptions);
    const { errors, warnings } = await runTypeCheck(typeCheckOptions);
    if (errors.length > 0) {
      printDiagnostics(errors, warnings);
      yield getResult(false);
    } else {
      if (warnings.length > 0) {
        printDiagnostics(errors, warnings);
      }
      yield getResult(initialSwcStatus);
    }
  }

  // watch
  while (true) {
    const { success: swcStatus, exit } = await promisifySwcWatcher();
    if (exit) {
      return getResult(swcStatus);
    }

    if (normalizedOptions.skipTypeCheck) {
      yield getResult(swcStatus);
    } else {
      const delayed = delay(5000);
      yield getResult(
        await Promise.race([
          delayed.start().then(() => ({ tscStatus: false, type: 'timeout' })),
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
      );
    }
  }
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
