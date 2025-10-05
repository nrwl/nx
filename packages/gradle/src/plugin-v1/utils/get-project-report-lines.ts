import { AggregateCreateNodesError, logger, output } from '@nx/devkit';
import { execGradleAsync, newLineSeparator } from '../../utils/exec-gradle';

/**
 * This function executes the gradle projectReportAll task and returns the output as an array of lines.
 * @param gradlewFile the absolute path to the gradlew file
 * @returns project report lines
 */
export async function getProjectReportLines(
  gradlewFile: string
): Promise<string[]> {
  let projectReportBuffer: Buffer;
  try {
    projectReportBuffer = await execGradleAsync(gradlewFile, [
      'projectReportAll',
      process.env.NX_VERBOSE_LOGGING === 'true' ? '--info' : '',
      '--exclude-task',
      'htmlDependencyReport',
    ]);
  } catch (e: Buffer | Error | any) {
    if (e.toString()?.includes('ERROR: JAVA_HOME')) {
      throw new AggregateCreateNodesError(
        [
          [
            gradlewFile,
            new Error(
              `Could not find Java. Please install Java and try again: https://www.java.com/en/download/help/index_installing.html.\n\r${e.toString()}`
            ),
          ],
        ],
        []
      );
    } else if (e.toString()?.includes(`Task 'projectReportAll' not found`)) {
      try {
        projectReportBuffer = await execGradleAsync(gradlewFile, [
          'projectReport',
        ]);
        logger.warn(
          `Could not run 'projectReportAll' task. Ran 'projectReport' instead. Please run 'nx generate @nx/gradle:init' to generate the necessary tasks.\n\r${e.toString()}`
        );
      } catch (e) {
        throw new AggregateCreateNodesError(
          [
            [
              gradlewFile,
              new Error(
                `Could not run 'projectReportAll' or 'projectReport' task. Please run 'nx generate @nx/gradle:init' to generate the necessary tasks.\n\r${e.toString()}`
              ),
            ],
          ],
          []
        );
      }
    } else {
      throw new AggregateCreateNodesError(
        [
          [
            gradlewFile,
            new Error(
              `Could not run 'projectReportAll' or 'projectReport' Gradle task. Please install Gradle and try again: https://gradle.org/install/.\r\n${e.toString()}`
            ),
          ],
        ],
        []
      );
    }
  }
  const projectReportLines = projectReportBuffer
    .toString()
    .split(newLineSeparator)
    .filter((line) => line.trim() !== '');

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    output.log({
      title: `Successfully ran projectReportAll or projectRerport task using ${gradlewFile}`,
      bodyLines: projectReportLines,
    });
  }

  return projectReportLines;
}
