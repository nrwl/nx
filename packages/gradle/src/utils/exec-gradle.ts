import { AggregateCreateNodesError, workspaceRoot } from '@nx/devkit';
import { ExecFileOptions, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { LARGE_BUFFER } from 'nx/src/executors/run-commands/run-commands.impl';
import {signalToCode} from "nx/src/utils/exit-codes";

export const fileSeparator = process.platform.startsWith('win')
  ? 'file:///'
  : 'file://';

export const newLineSeparator = process.platform.startsWith('win')
  ? '\r\n'
  : '\n';

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
  return new Promise<Buffer>((res, rej: (stdout: Buffer) => void) => {
    const cp = execFile(gradleBinaryPath, args, {
      cwd: dirname(gradleBinaryPath),
      shell: true,
      windowsHide: true,
      env: process.env,
      maxBuffer: LARGE_BUFFER,
      ...execOptions,
    });

    let stdout = Buffer.from('');
    cp.stdout?.on('data', (data) => {
      stdout += data;
    });
    cp.stderr?.on('data', (data) => {
      stdout += data;
    });

    cp.on('exit', (code, signal) => {
      if (code === null) code = signalToCode(signal);
      if (code === 0) {
        res(stdout);
      } else {
        rej(stdout);
      }
    });
  });
}

/**
 * This function recursively finds the nearest gradlew file in the workspace
 * @param filePathToSearch the original file to search for, relative to workspace root, file path not directory path
 * @param workspaceRoot workspace root
 * @param currentSearchPath the path to start searching for gradlew file
 * @param customGradleInstallation a custom gradle installation path to search at
 * @returns the relative path of the gradlew file to workspace root, throws an error if gradlew file is not found
 * It will return relative path to workspace root of gradlew.bat file on windows and gradlew file on other platforms
 */
export function findGradlewFile(
  filePathToSearch: string,
  workspaceRoot: string,
  customGradleInstallation?: string,
): string {
  if (customGradleInstallation) {
    return findGradlewUsingCustomInstallationPath(customGradleInstallation, workspaceRoot);
  }

  return findGradlewUsingFilePathTraversal(filePathToSearch, workspaceRoot);
}


export function findGradlewUsingFilePathTraversal(
  filePathToSearch: string,
  workspaceRoot: string,
  currentSearchPath?: string
) {
  currentSearchPath ??= filePathToSearch;
  const parent = dirname(currentSearchPath);
  if (currentSearchPath === parent) {
    throw new AggregateCreateNodesError(
      [
        [
          filePathToSearch,
          new Error(`No Gradlew file found at ${filePathToSearch} or any of its parent directories. Run "gradle init"`),
        ],
      ],
      []
    );
  }

  const gradlewPath = join(parent, 'gradlew');
  const gradlewBatPath = join(parent, 'gradlew.bat');

  if (process.platform.startsWith('win')) {
    if (existsSync(join(workspaceRoot, gradlewBatPath))) {
      return gradlewBatPath;
    }
  } else {
    if (existsSync(join(workspaceRoot, gradlewPath))) {
      return gradlewPath;
    }
  }

  return findGradlewUsingFilePathTraversal(filePathToSearch, workspaceRoot, parent);
}

export function findGradlewUsingCustomInstallationPath(customGradleInstallation: string, workspaceRoot: string) {
  // Resolve the custom installation path - if relative, resolve against workspace root
  const resolvedInstallationPath = isAbsolute(customGradleInstallation)
    ? customGradleInstallation
    : join(workspaceRoot, customGradleInstallation);

  const customGradlewPath = join(resolvedInstallationPath, 'gradlew');
  const customGradlewBatPath = join(resolvedInstallationPath, 'gradlew.bat');

  if (process.platform.startsWith('win')) {
    if (existsSync(customGradlewBatPath)) {
      // Return path relative to workspace root if it was relative, otherwise return absolute
      return isAbsolute(customGradleInstallation)
        ? customGradlewBatPath
        : join(customGradleInstallation, 'gradlew.bat');
    }
  } else {
    if (existsSync(customGradlewPath)) {
      // Return path relative to workspace root if it was relative, otherwise return absolute
      return isAbsolute(customGradleInstallation)
        ? customGradlewPath
        : join(customGradleInstallation, 'gradlew');
    }
  }

  throw new AggregateCreateNodesError(
    [
      [
        customGradleInstallation,
        new Error(`No Gradlew file found at ${customGradleInstallation}. Run "gradle init"`),
      ],
    ],
    []
  );
}
