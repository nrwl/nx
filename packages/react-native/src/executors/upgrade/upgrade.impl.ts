import { ExecutorContext } from '@nx/devkit';
import { resolve as pathResolve } from 'path';
import { ChildProcess, fork } from 'child_process';

import { UpgradeExecutorSchema } from './schema';

export interface ReactNativeUpgradeOutput {
  success: boolean;
}

/**
 * This executor is equivalent to `npx react-native upgrade`.
 * https://github.com/react-native-community/cli/blob/main/packages/cli/src/commands/upgrade/upgrade.ts
 */
export default async function* upgradeExecutor(
  options: UpgradeExecutorSchema,
  context: ExecutorContext
): AsyncGenerator<ReactNativeUpgradeOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  await runCliUpgrade(context.root, projectRoot);
  yield { success: true };
}

export function runCliUpgrade(
  workspaceRoot: string,
  projectRoot: string
): Promise<ChildProcess> {
  return new Promise<ChildProcess>((resolve, reject) => {
    const childProcess = fork(
      require.resolve('react-native/cli.js'),
      ['upgrade'],
      {
        stdio: 'inherit',
        cwd: pathResolve(workspaceRoot, projectRoot),
        env: process.env,
      }
    );

    /**
     * Ensure the child process is killed when the parent exits
     */
    const processExitListener = (signal?: number | NodeJS.Signals) => () => {
      childProcess.kill(signal);
      process.exit();
    };
    process.once('exit', (signal) => childProcess.kill(signal));
    process.once('SIGTERM', processExitListener);
    process.once('SIGINT', processExitListener);
    process.once('SIGQUIT', processExitListener);

    childProcess.on('error', (err) => {
      reject(err);
    });
    childProcess.on('exit', (code) => {
      if (code === 0) {
        resolve(childProcess);
      } else {
        reject(code);
      }
    });
  });
}
