import * as path from 'path';
import { execSync, spawn, SpawnOptions } from 'child_process';
import { output } from '@nrwl/devkit';

export function showNxWarning(workspaceName: string) {
  try {
    const pathToRunNxCommand = path.resolve(process.cwd(), workspaceName);
    execSync('nx --version', {
      cwd: pathToRunNxCommand,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch {
    // no nx found
    output.addVerticalSeparator();
    output.note({
      title: `Nx CLI is not installed globally.`,
      bodyLines: [
        `This means that you might have to use "yarn nx" or "npx nx" to execute commands in the workspace.`,
        `Run "yarn global add nx" or "npm install -g nx" to be able to execute command directly.`,
      ],
    });
  }
}

/*
 * Because we don't want to depend on @nrwl/workspace
 * we duplicate the helper functions from @nrwl/workspace in this file.
 */
export function deduceDefaultBase(): string {
  const nxDefaultBase = 'main';
  try {
    return (
      execSync('git config --get init.defaultBranch').toString().trim() ||
      nxDefaultBase
    );
  } catch {
    return nxDefaultBase;
  }
}

function checkGitVersion(): string | null {
  try {
    let gitVersionOutput = execSync('git --version').toString().trim();
    return gitVersionOutput.match(/[0-9]+\.[0-9]+\.+[0-9]+/)[0];
  } catch {
    return null;
  }
}

/*
 * Because we don't want to depend on create-nx-workspace
 * we duplicate the helper functions from create-nx-workspace in this file.
 */
export async function initializeGitRepo(directory: string) {
  const execute = (args: ReadonlyArray<string>, ignoreErrorStream = false) => {
    const errorStream = ignoreErrorStream ? 'ignore' : process.stderr;
    const spawnOptions: SpawnOptions = {
      stdio: [process.stdin, 'ignore', errorStream],
      shell: true,
      cwd: directory,
      env: process.env,
    };
    return new Promise<void>((resolve, reject) => {
      spawn('git', args, spawnOptions).on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
    });
  };
  const gitVersion = checkGitVersion();
  if (!gitVersion) {
    return;
  }
  const insideRepo = await execute(
    ['rev-parse', '--is-inside-work-tree'],
    true
  ).then(
    () => true,
    () => false
  );
  if (insideRepo) {
    output.log({
      title:
        'Directory is already under version control. Skipping initialization of git.',
    });
    return;
  }
  const defaultBase = deduceDefaultBase();
  const [gitMajor, gitMinor] = gitVersion.split('.');

  if (+gitMajor > 2 || (+gitMajor === 2 && +gitMinor >= 28)) {
    await execute(['init', '-b', defaultBase]);
  } else {
    await execute(['init']);
    await execute(['checkout', '-b', defaultBase]); // Git < 2.28 doesn't support -b on git init.
  }
  await execute(['add', '.']);
  const message = 'Initial commit';
  await execute(['commit', `-m "${message}"`]);
  output.log({
    title: 'Successfully initialized git.',
  });
}
