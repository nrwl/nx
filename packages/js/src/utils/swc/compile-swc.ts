import { ExecutorContext, logger } from '@nrwl/devkit';
import { exec, execSync } from 'child_process';
import { normalizeTsCompilationOptions } from '../normalize-ts-compilation-options';
import { NormalizedExecutorOptions } from '../schema';

export async function compileSwc(
  context: ExecutorContext,
  normalizedOptions: NormalizedExecutorOptions,
  postCompilationCallback: () => void | Promise<void>
): Promise<{ success: boolean }> {
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

  // TODO(chau): use `--ignore` for swc cli to exclude spec files
  // Open issue: https://github.com/swc-project/cli/issues/20
  let swcCmd = `npx swc ${srcPath} -d ${destPath} --source-maps --config-file=${swcrcPath}`;

  if (normalizedOptions.watch) {
    swcCmd += ' --watch';
    return createSwcWatchProcess(swcCmd, postCompilationCallback);
  }

  const swcCmdLog = execSync(swcCmd).toString();
  logger.log(swcCmdLog.replace(/\n/, ''));
  await postCompilationCallback();
  return { success: true };
}

async function createSwcWatchProcess(
  swcCmd: string,
  postCompilationCallback: () => void | Promise<void>
): Promise<{ success: boolean }> {
  return new Promise((res) => {
    const watchProcess = exec(swcCmd);

    watchProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
      if (data.includes('Successfully compiled')) {
        postCompilationCallback();
      }
    });

    watchProcess.stderr.on('data', (err) => {
      process.stderr.write(err);
      res({ success: false });
    });

    const processExitListener = () => watchProcess.kill();

    process.on('SIGINT', processExitListener);
    process.on('SIGTERM', processExitListener);
    process.on('exit', processExitListener);

    watchProcess.on('exit', () => {
      res({ success: true });
    });
  });
}
