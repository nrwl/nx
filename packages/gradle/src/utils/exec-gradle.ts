import { AggregateCreateNodesError, workspaceRoot } from '@nx/devkit';
import { ExecFileOptions, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * For gradle command, it needs to be run from the directory of the gradle binary
 * @returns gradle binary file name
 */
export function getGradleExecFile(): string {
  return process.platform.startsWith('win') ? '.\\gradlew.bat' : './gradlew';
}

/**
 * This function executes gradle with the given arguments
 * @param gradleBinaryPath absolute path to gradle binary
 * @param args args passed to gradle
 * @param execOptions exec options
 * @returns promise with the stdout buffer
 */
export function execGradleAsync(
  gradleBinaryPath: string,
  args: ReadonlyArray<string>,
  execOptions: ExecFileOptions = {}
): Promise<Buffer> {
  return new Promise<Buffer>((res, rej) => {
    const cp = execFile(gradleBinaryPath, args, {
      cwd: dirname(gradleBinaryPath),
      shell: true,
      windowsHide: true,
      env: process.env,
      ...execOptions,
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

/**
 * This function recursively finds the nearest gradlew file in the workspace
 * @param originalFileToSearch the original file to search for
 * @param wr workspace root
 * @param currentSearchPath the path to start searching for gradlew file
 * @returns the relative path of the gradlew file to workspace root, throws an error if gradlew file is not found
 * It will return gradlew.bat file on windows and gradlew file on other platforms
 */
export function findGraldewFile(
  originalFileToSearch: string,
  wr: string = workspaceRoot,
  currentSearchPath?: string
): string {
  currentSearchPath ??= originalFileToSearch;
  const parent = dirname(currentSearchPath);
  if (currentSearchPath === parent) {
    throw new AggregateCreateNodesError(
      [
        [
          originalFileToSearch,
          new Error('No Gradlew file found. Run "gradle init"'),
        ],
      ],
      []
    );
  }

  const gradlewPath = join(parent, 'gradlew');
  const gradlewBatPath = join(parent, 'gradlew.bat');

  if (process.platform.startsWith('win')) {
    if (existsSync(join(wr, gradlewBatPath))) {
      return gradlewBatPath;
    }
  } else {
    if (existsSync(join(wr, gradlewPath))) {
      return gradlewPath;
    }
  }

  return findGraldewFile(originalFileToSearch, wr, parent);
}
