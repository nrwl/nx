import { AggregateCreateNodesError, output } from '@nx/devkit';
import { execGradleAsync, newLineSeparator } from '../../utils/exec-gradle';

export async function getNxProjectGraphLines(
  gradlewFile: string,
  gradleConfigHash: string
): Promise<string[]> {
  let nxProjectGraphBuffer: Buffer;

  try {
    nxProjectGraphBuffer = await execGradleAsync(gradlewFile, [
      'nxProjectGraph',
      `-Phash=${gradleConfigHash}`,
      '--no-configuration-cache', // disable configuration cache
      '--parallel', // add parallel to improve performance
      '--build-cache', // enable build cache
      '--warning-mode',
      'none',
      process.env.NX_VERBOSE_LOGGING ? '--info' : '',
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
    } else if (e.toString()?.includes(`Task 'nxProjectGraph' not found`)) {
      throw new AggregateCreateNodesError(
        [
          [
            gradlewFile,
            new Error(
              `Could not run 'nxProjectGraph' task. Please run 'nx generate @nx/gradle:init' to generate the necessary tasks.\n\r${e.toString()}`
            ),
          ],
        ],
        []
      );
    } else {
      throw new AggregateCreateNodesError(
        [
          [
            gradlewFile,
            new Error(
              `Could not run 'nxProjectGraph' Gradle task. Please install Gradle and try again: https://gradle.org/install/.\r\n${e.toString()}`
            ),
          ],
        ],
        []
      );
    }
  }

  const projectGraphLines = nxProjectGraphBuffer
    .toString()
    .split(newLineSeparator)
    .filter((line) => line.trim() !== '');

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    output.log({
      title: `Successfully ran 'nxProjectGraph' task using ${gradlewFile} with hash ${gradleConfigHash}`,
      bodyLines: projectGraphLines,
    });
  }

  return projectGraphLines;
}
