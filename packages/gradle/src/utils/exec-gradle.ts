import { workspaceRoot } from '@nx/devkit';
import { ExecFileOptions, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function getGradleBinaryPath(): string {
  const gradleFile = process.platform.startsWith('win')
    ? 'gradlew.bat'
    : 'gradlew';
  const gradleBinaryPath = join(workspaceRoot, gradleFile);
  if (!existsSync(gradleBinaryPath)) {
    throw new Error('Gradle is not setup. Run "gradle init"');
  }

  return gradleBinaryPath;
}

export function getGradleExecFile(): string {
  return process.platform.startsWith('win') ? '.\\gradlew.bat' : './gradlew';
}

export function execGradleAsync(
  args: ReadonlyArray<string>,
  execOptions: ExecFileOptions = {}
): Promise<Buffer> {
  const gradleBinaryPath = getGradleBinaryPath();

  return new Promise<Buffer>((res, rej) => {
    const cp = execFile(gradleBinaryPath, args, {
      ...execOptions,
      shell: true,
      windowsHide: true,
    });

    let stdout = Buffer.from('');
    cp.stdout?.on('data', (data) => {
      stdout += data;
    });

    cp.on('exit', (code) => {
      if (code === 0) {
        res(stdout);
      } else {
        rej(
          new Error(
            `Executing Gradle with ${args.join(
              ' '
            )} failed with code: ${code}. \nLogs: ${stdout}`
          )
        );
      }
    });
  });
}
