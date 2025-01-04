import { AggregateCreateNodesError, logger, workspaceRoot } from '@nx/devkit';
import { execGradleAsync, newLineSeparator } from '../../utils/exec-gradle';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { cacheDirectoryForWorkspace } from 'nx/src/utils/cache-directory';

export async function getCreateNodesLines(gradlewFile: string) {
  let createNodesBuffer: Buffer;

  // if there is no build.gradle or build.gradle.kts file, we cannot run the createNodes task
  if (
    !existsSync(join(dirname(gradlewFile), 'build.gradle')) &&
    !existsSync(join(dirname(gradlewFile), 'build.gradle.kts'))
  ) {
    logger.warn(
      `Could not find build file near ${gradlewFile}. Please run 'nx generate @nx/gradle:init' to generate the necessary tasks.`
    );
    return [];
  }

  try {
    createNodesBuffer = await execGradleAsync(gradlewFile, [
      'createNodes',
      '--outputDirectory',
      cacheDirectoryForWorkspace(workspaceRoot),
      '--workspaceRoot',
      workspaceRoot,
    ]);
  } catch (e) {
    throw new AggregateCreateNodesError(
      [
        [
          gradlewFile,
          new Error(
            `Could not run 'createNodes' task using ${gradlewFile}. Please run 'nx generate @nx/gradle:init' to generate the necessary tasks. ${e.message}`,
            { cause: e }
          ),
        ],
      ],
      []
    );
  }
  return createNodesBuffer
    .toString()
    .split(newLineSeparator)
    .filter((line) => line.trim() !== '');
}
