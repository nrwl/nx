import { ExecutorContext, logger } from '@nrwl/devkit';
import { exec, execSync } from 'child_process';
import { Observable } from 'rxjs';
import { normalizeTsCompilationOptions } from '../normalize-ts-compilation-options';
import { NormalizedSwcExecutorOptions } from '../schema';

export function compileSwc(
  context: ExecutorContext,
  normalizedOptions: NormalizedSwcExecutorOptions,
  postCompilationCallback: () => void | Promise<void>
) {
  // const ts = await import('typescript');

  const tsOptions = {
    outputPath: normalizedOptions.outputPath,
    projectName: context.projectName,
    projectRoot: normalizedOptions.projectRoot,
    tsConfig: normalizedOptions.tsConfig,
    watch: normalizedOptions.watch,
  };

  const normalizedTsOptions = normalizeTsCompilationOptions(tsOptions);
  logger.log(`Compiling with SWC for ${normalizedTsOptions.projectName}...`);
  const srcPath = normalizedTsOptions.projectRoot;
  const destPath = normalizedTsOptions.outputPath.replace(
    `/${normalizedTsOptions.projectName}`,
    ''
  );
  const swcrcPath = `${normalizedTsOptions.projectRoot}/.swcrc`;
  let swcCmd = `npx swc ${srcPath} -d ${destPath} --source-maps --config-file=${swcrcPath}`;

  const compile$ = new Observable((subscriber) => {
    if (normalizedOptions.watch) {
      swcCmd += ' --watch';
      const watchProcess = createSwcWatchProcess(swcCmd, async (success) => {
        if (success) {
          await postCompilationCallback();
          subscriber.next({ success });
        } else {
          subscriber.error();
        }
      });

      return () => {
        watchProcess.close();
        subscriber.complete();
      };
    }

    const swcCmdLog = execSync(swcCmd).toString();
    logger.log(swcCmdLog.replace(/\n/, ''));

    (postCompilationCallback() as Promise<void>).then(() => {
      subscriber.next({ success: true });
      subscriber.complete();
    });

    return () => {
      subscriber.complete();
    };
  });

  if (normalizedOptions.skipTypeCheck) {
    return compile$;
  }

  return compile$;
  //
  //
  // logger.log(`Compiling with SWC for ${normalizedTsOptions.projectName}...`);
  //
  // // TODO(chau): use `--ignore` for swc cli to exclude spec files
  // // Open issue: https://github.com/swc-project/cli/issues/20
  //
  // if (normalizedOptions.watch) {
  //   swcCmd += ' --watch';
  //   return createSwcWatchProcess(swcCmd, postCompilationCallback);
  // }
  //
  // const swcCmdLog = execSync(swcCmd).toString();
  // logger.log(swcCmdLog.replace(/\n/, ''));
  // await postCompilationCallback();
  // return { success: true };
}

function createSwcWatchProcess(
  swcCmd: string,
  callback: (success: boolean) => void
) {
  const watchProcess = exec(swcCmd);

  watchProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
    if (data.includes('Successfully compiled')) {
      callback(true);
    }
  });

  watchProcess.stderr.on('data', (err) => {
    process.stderr.write(err);
    callback(false);
  });

  const processExitListener = () => watchProcess.kill();

  process.on('SIGINT', processExitListener);
  process.on('SIGTERM', processExitListener);
  process.on('exit', processExitListener);

  watchProcess.on('exit', () => {
    callback(true);
  });

  return { close: () => watchProcess.kill() };
}
