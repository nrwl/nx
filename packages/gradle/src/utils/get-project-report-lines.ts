import { AggregateCreateNodesError, logger } from '@nx/devkit';
import { execGradleAsync } from './exec-gradle';
import { existsSync } from 'fs';
import { dirname, join } from 'path';

export const fileSeparator = process.platform.startsWith('win')
  ? 'file:///'
  : 'file://';

export const newLineSeparator = process.platform.startsWith('win')
  ? '\r\n'
  : '\n';

/**
 * This function executes the gradle projectReportAll task and returns the output as an array of lines.
 * @param gradlewFile the absolute path to the gradlew file
 * @returns project report lines
 */
export async function getProjectReportLines(
  gradlewFile: string
): Promise<string[]> {
  let projectReportBuffer: Buffer;

  // if there is no build.gradle or build.gradle.kts file, we cannot run the projectReport nor projectReportAll task
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
    projectReportBuffer = await execGradleAsync(gradlewFile, [
      'projectReportAll',
    ]);
  } catch (e) {
    try {
      projectReportBuffer = await execGradleAsync(gradlewFile, [
        'projectReport',
      ]);
      logger.warn(
        `Could not run 'projectReportAll' task. Ran 'projectReport' instead. Please run 'nx generate @nx/gradle:init' to generate the necessary tasks.`
      );
    } catch (e) {
      throw new AggregateCreateNodesError(
        [
          [
            gradlewFile,
            new Error(
              `Could not run 'projectReportAll' or 'projectReport' task. Please run 'nx generate @nx/gradle:init' to generate the necessary tasks.`
            ),
          ],
        ],
        []
      );
    }
  }
  return projectReportBuffer
    .toString()
    .split(newLineSeparator)
    .filter((line) => line.trim() !== '');
}
