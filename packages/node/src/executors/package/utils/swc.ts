import {
  normalizeOptions,
  TypeScriptCompilationOptions,
} from '@nrwl/workspace/src/utilities/typescript/compilation';
import { exec, execSync } from 'child_process';
import { appRootPath } from '@nrwl/workspace/src/utils/app-root';
import { join } from 'path';
import { forkTypeDeclarationEmitter } from './fork-type-declaration-emitter';

export async function execSwc(
  tscOptions: TypeScriptCompilationOptions,
  hasDependencies: boolean,
  completeCallback: () => void | Promise<void>
) {
  const normalizedTscOptions = normalizeOptions(tscOptions);

  try {
    console.log(
      `Generating d.ts files for ${normalizedTscOptions.projectName}...`
    );

    let validTypes = true;
    try {
      await forkTypeDeclarationEmitter({
        workspaceRoot: appRootPath,
        projectRoot: join(
          appRootPath,
          hasDependencies ? 'tmp' : '',
          normalizedTscOptions.projectRoot
        ),
        configPath: normalizedTscOptions.tsConfig,
        outDir: normalizedTscOptions.outputPath.replace(
          normalizedTscOptions.projectRoot,
          ''
        ),
      });
      console.log(
        `Done generating d.ts files for ${normalizedTscOptions.projectName}`
      );
    } catch {
      validTypes = false;
    }
    if (!validTypes) {
      return { success: false };
    }

    console.log(
      `Compiling with SWC for ${normalizedTscOptions.projectName}...`
    );

    const srcPath = `${normalizedTscOptions.projectRoot}/src`;
    const destPath = normalizedTscOptions.outputPath.replace(
      `/${normalizedTscOptions.projectName}`,
      ''
    );

    // TODO(chau): use `--ignore` for swc cli to exclude spec files
    // Open issue: https://github.com/swc-project/cli/issues/20
    let swcCmd = `npx swc ${srcPath} -d ${destPath} --source-maps`;

    if (normalizedTscOptions.watch) {
      swcCmd += ' --watch';
      return createSwcWatchProcess(swcCmd, completeCallback);
    }

    const swcCmdLog = execSync(swcCmd).toString();
    console.log(swcCmdLog.replace(/\n/, ''));
    await completeCallback();
    return { success: true };
  } catch (e) {
    console.error(
      `Error compiling with SWC for ${normalizedTscOptions.projectName}`,
      e
    );
    return { success: false };
  }
}

async function createSwcWatchProcess(
  swcCmd: string,
  callback: () => void | Promise<void>
) {
  return new Promise((res) => {
    const watchProcess = exec(swcCmd);

    watchProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
      if (data.includes('Successfully compiled')) {
        callback();
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
      console.log('exit', args);
      res({ success: true });
    });
  });
}
