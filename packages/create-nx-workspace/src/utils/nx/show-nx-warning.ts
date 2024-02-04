import { execSync } from 'child_process';
import { resolve } from 'path';
import { output } from '../output';
import { getPackageManagerCommand } from '../package-manager';

export function showNxWarning(workspaceName: string) {
  try {
    const pathToRunNxCommand = resolve(process.cwd(), workspaceName);
    execSync('nx --version', {
      cwd: pathToRunNxCommand,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch (e) {
    // no nx found
    const { exec, globalAdd } = getPackageManagerCommand();
    output.addVerticalSeparator();
    output.note({
      title: `Nx CLI is not installed globally.`,
      bodyLines: [
        `This means that you will have to use "${exec} nx" to execute commands in the workspace.`,
        `Run "${globalAdd} nx" to be able to execute command directly.`,
      ],
    });
  }
}
