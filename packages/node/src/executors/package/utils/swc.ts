import {
  normalizeOptions,
  TypeScriptCompilationOptions,
} from '@nrwl/workspace/src/utilities/typescript/compilation';
import { exec, execSync } from 'child_process';

export async function execSwc(
  tscOptions: TypeScriptCompilationOptions,
  completeCallback: () => void | Promise<void>
) {
  const normalizedTscOptions = normalizeOptions(tscOptions);

  try {
    console.log(
      `Compiling with SWC for ${normalizedTscOptions.projectName}...`
    );

    const srcPath = `${normalizedTscOptions.projectRoot}/src`;
    const destPath = normalizedTscOptions.outputPath.replace(
      `/${normalizedTscOptions.projectName}`,
      ''
    );
    // TODO(chau): ignore/exclude don't work with swc
    const exclude = `'${normalizedTscOptions.projectRoot}/src/**/*.spec.ts'`;

    let swcCmd = `npx swc ${srcPath} -d ${destPath} --source-maps --config exclude=${exclude}`;

    if (normalizedTscOptions.watch) {
      swcCmd += ' --watch';
      return createSwcWatchProcess(swcCmd, completeCallback);
    }

    execSync(swcCmd);
    console.log(
      `Done compiling with SWC for ${normalizedTscOptions.projectName}.`
    );
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
