import {
  AggregateCreateNodesError,
  NxJsonConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { SpawnOptions } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { GradlePluginOptions } from '../plugin/utils/gradle-plugin-options';
import {
  killChildOnHostExit,
  killProcessTreeGraceful,
  safeSpawn,
  signalToCode,
} from '@nx/devkit/internal';

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
  execOptions: Omit<SpawnOptions, 'shell'> = {}
): Promise<Buffer> {
  // Extract signal so we can handle cancellation with a process-tree kill
  // instead of Node's default which only kills the immediate child.
  const { signal, ...restOptions } = execOptions;

  return new Promise<Buffer>((res, rej: (e: Buffer | Error) => void) => {
    // Without the filter, empty args reach gradle as literal empty arguments.
    const cp = safeSpawn(gradleBinaryPath, args.filter(Boolean), {
      cwd: dirname(gradleBinaryPath),
      env: process.env,
      ...restOptions,
    });

    // A plugin worker torn down by `nx reset` would otherwise orphan the build.
    killChildOnHostExit(cp);
    let stdout = Buffer.from('');

    // On abort, kill the entire process tree (gradlew spawns java) and settle
    // immediately — a wedged JVM that outlives the kill signal would otherwise
    // keep this promise pending and the abort error would never surface.
    const onAbort = () => {
      if (cp.pid) {
        killProcessTreeGraceful(cp.pid).catch(() => {});
      }
      rej(stdout);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    cp.stdout?.on('data', (data) => {
      stdout += data;
    });
    cp.stderr?.on('data', (data) => {
      stdout += data;
    });

    // Without a shell the child is gradlew itself, so spawn can fail outright —
    // Node then emits `error` and never `exit`.
    cp.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort);
      rej(err);
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
