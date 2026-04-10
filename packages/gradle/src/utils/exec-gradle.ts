import {
  AggregateCreateNodesError,
  NxJsonConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { ExecFileOptions, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { LARGE_BUFFER } from 'nx/src/executors/run-commands/run-commands.impl';
import { GradlePluginOptions } from '../plugin/utils/gradle-plugin-options';
import { signalToCode } from 'nx/src/utils/exit-codes';
import treeKill from 'tree-kill';

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
  // Extract signal so we can handle cancellation with tree-kill
  // instead of Node's default which only kills the immediate child.
  const { signal, ...restOptions } = execOptions;

  return new Promise<Buffer>((res, rej: (stdout: Buffer) => void) => {
    const cp = execFile(
      gradleBinaryPath,
      args,
      {
        cwd: dirname(gradleBinaryPath),
        shell: true,
        windowsHide: true,
        env: process.env,
        maxBuffer: LARGE_BUFFER,
        ...restOptions,
      },
      undefined
    );

    // Use tree-kill on abort to kill the entire process tree
    // (cmd.exe → gradlew.bat → java.exe), not just the shell.
    const onAbort = () => {
      if (cp.pid) {
        treeKill(cp.pid);
      }
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    let stdout = Buffer.from('');
    cp.stdout?.on('data', (data) => {
      stdout += data;
    });
    cp.stderr?.on('data', (data) => {
      stdout += data;
    });

    cp.on('exit', (code, s) => {
      signal?.removeEventListener('abort', onAbort);
      if (code === null) code = signalToCode(s);
      if (code === 0) {
        res(stdout);
      } else {
        rej(stdout);
      }
    });
  });
}

export function getCustomGradleExecutableDirectoryFromPlugin(
  nxJson: NxJsonConfiguration
): string | undefined {
  const gradlePlugin = nxJson.plugins?.find((plugin) => {
    if (typeof plugin === 'string') {
      return plugin === '@nx/gradle';
    }
    return plugin.plugin === '@nx/gradle';
  });

  return gradlePlugin && typeof gradlePlugin !== 'string'
    ? (gradlePlugin.options as GradlePluginOptions)?.gradleExecutableDirectory
    : undefined;
}

/**
 * This function recursively finds the nearest gradlew file in the workspace
 * @param filePathToSearch the original file to search for, relative to workspace root, file path not directory path
 * @param workspaceRoot workspace root
 * @param customExecutableDirectory a custom directory to search for the gradle wrapper file
 * @returns the relative path of the gradlew file to workspace root, throws an error if gradlew file is not found
 * It will return relative path to workspace root of gradlew.bat file on windows and gradlew file on other platforms
 */
export function findGradlewFile(
  filePathToSearch: string,
  workspaceRoot: string,
  customExecutableDirectory?: string
): string {
  if (customExecutableDirectory) {
    return findGradlewUsingCustomExecutableDirectory(
      customExecutableDirectory,
      workspaceRoot
    );
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
          new Error(
            `No Gradlew file found at ${filePathToSearch} or any of its parent directories. Run "gradle init"`
          ),
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

  return findGradlewUsingFilePathTraversal(
    filePathToSearch,
    workspaceRoot,
    parent
  );
}

export function findGradlewUsingCustomExecutableDirectory(
  customGradleExecutableDirectory: string,
  workspaceRoot: string
) {
  // Resolve the custom installation path - if relative, resolve against workspace root
  const resolvedInstallationPath = isAbsolute(customGradleExecutableDirectory)
    ? customGradleExecutableDirectory
    : join(workspaceRoot, customGradleExecutableDirectory);

  const customGradlewPath = join(resolvedInstallationPath, 'gradlew');
  const customGradlewBatPath = join(resolvedInstallationPath, 'gradlew.bat');

  if (process.platform.startsWith('win')) {
    if (existsSync(customGradlewBatPath)) {
      // Return path relative to workspace root if it was relative, otherwise return absolute
      return isAbsolute(customGradleExecutableDirectory)
        ? customGradlewBatPath
        : join(customGradleExecutableDirectory, 'gradlew.bat');
    }
  } else {
    if (existsSync(customGradlewPath)) {
      // Return path relative to workspace root if it was relative, otherwise return absolute
      return isAbsolute(customGradleExecutableDirectory)
        ? customGradlewPath
        : join(customGradleExecutableDirectory, 'gradlew');
    }
  }

  throw new AggregateCreateNodesError(
    [
      [
        customGradleExecutableDirectory,
        new Error(
          `No Gradlew file found at custom gradle executable directory. Please ensure that there is a gradle wrapper file located at ${customGradleExecutableDirectory}`
        ),
      ],
    ],
    []
  );
}
