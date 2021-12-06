import { logger } from '@nrwl/devkit';
import { TypeScriptCompilationOptions } from '@nrwl/workspace/src/utilities/typescript/compilation';
import { exec, execSync } from 'child_process';
import { normalizeTsCompilationOptions } from '../normalize-ts-compilation-options';

export async function compileSwc(
  tsCompilationOptions: TypeScriptCompilationOptions,
  postCompilationCallback: () => void | Promise<void>
): Promise<{ success: boolean }> {
  const normalizedOptions = normalizeTsCompilationOptions(tsCompilationOptions);

  logger.log(`Compiling with SWC for ${normalizedOptions.projectName}...`);
  const srcPath = normalizedOptions.projectRoot;
  const destPath = normalizedOptions.outputPath.replace(
    `/${normalizedOptions.projectName}`,
    ''
  );
  const swcrcPath = `${normalizedOptions.projectRoot}/.swcrc`;

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

    watchProcess.on('exit', (args) => {
      logger.log('exit', args);
      res({ success: true });
    });
  });
}
