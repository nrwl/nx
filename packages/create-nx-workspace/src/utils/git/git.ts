import { execSync, spawn, SpawnOptions } from 'child_process';
import { deduceDefaultBase } from './default-base';
import { output } from '../output';

export function checkGitVersion(): string | null | undefined {
  try {
    let gitVersionOutput = execSync('git --version').toString().trim();
    return gitVersionOutput.match(/[0-9]+\.[0-9]+\.+[0-9]+/)?.[0];
  } catch {
    return null;
  }
}

export async function initializeGitRepo(
  directory: string,
  options: {
    defaultBase: string;
    commit?: { message: string; name: string; email: string };
  }
) {
  const execute = (args: ReadonlyArray<string>, ignoreErrorStream = false) => {
    const outputStream = 'ignore';
    const errorStream = ignoreErrorStream ? 'ignore' : process.stderr;
    const spawnOptions: SpawnOptions = {
      stdio: [process.stdin, outputStream, errorStream],
      shell: true,
      cwd: directory,
      env: {
        ...process.env,
        ...(options.commit?.name
          ? {
              GIT_AUTHOR_NAME: options.commit.name,
              GIT_COMMITTER_NAME: options.commit.name,
            }
          : {}),
        ...(options.commit?.email
          ? {
              GIT_AUTHOR_EMAIL: options.commit.email,
              GIT_COMMITTER_EMAIL: options.commit.email,
            }
          : {}),
      },
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
  const defaultBase = options.defaultBase || deduceDefaultBase();
  const [gitMajor, gitMinor] = gitVersion.split('.');

  if (+gitMajor > 2 || (+gitMajor === 2 && +gitMinor >= 28)) {
    await execute(['init', '-b', defaultBase]);
  } else {
    await execute(['init']);
    await execute(['checkout', '-b', defaultBase]); // Git < 2.28 doesn't support -b on git init.
  }
  await execute(['add', '.']);
  if (options.commit) {
    const message = options.commit.message || 'initial commit';
    await execute(['commit', `-m "${message}"`]);
  }
}
