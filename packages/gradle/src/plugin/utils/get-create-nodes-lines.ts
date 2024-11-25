import { AggregateCreateNodesError, logger, output } from '@nx/devkit';
import { execGradleAsync, newLineSeparator } from '../../utils/exec-gradle';
import { existsSync } from 'fs';
import { dirname, join } from 'path';

export async function getCreateNodesLines(
  gradlewFile: string,
  gradleConfigHash: string
): Promise<string[]> {
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
      `-Phash=${gradleConfigHash}`,
      '--no-configuration-cache', // disable configuration cache
      '--parallel', // add parallel to improve performance
      '--build-cache', // enable build cache
      '--warning-mode',
      'none',
      process.env.NX_VERBOSE_LOGGING ? '--info' : '',
    ]);
  } catch (e) {
    throw new AggregateCreateNodesError(
      [
        [
          gradlewFile,
          new Error(
            `Could not run 'createNodes' task using ${gradlewFile}. Please run 'nx generate @nx/gradle:init' to generate the necessary tasks. ${
              e.message ?? e
            }`,
            { cause: e }
          ),
        ],
      ],
      []
    );
  }

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    output.log({
      title: `Successfully ran 'createNodes' task using ${gradlewFile} with hash ${gradleConfigHash}`,
      bodyLines: createNodesBuffer.toString().split(newLineSeparator),
    });
  }
  return createNodesBuffer
    .toString()
    .split(newLineSeparator)
    .filter((line) => line.trim() !== '');
}
