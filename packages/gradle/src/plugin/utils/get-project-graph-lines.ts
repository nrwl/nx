import { AggregateCreateNodesError, output, workspaceRoot } from '@nx/devkit';
import { execGradleAsync, newLineSeparator } from '../../utils/exec-gradle';
import { GradlePluginOptions } from './gradle-plugin-options';
import { dirname } from 'node:path';

export async function getNxProjectGraphLines(
  gradlewFile: string,
  gradleConfigHash: string,
  gradlePluginOptions: GradlePluginOptions
): Promise<string[]> {
  if (process.env.VERCEL) {
    // skip on Vercel
    return [];
  }

  let nxProjectGraphBuffer: Buffer;

  const gradlePluginOptionsArgs =
    Object.entries(gradlePluginOptions ?? {})?.map(
      ([key, value]) => `-P${key}=${value}`
    ) ?? [];

  try {
    nxProjectGraphBuffer = await execGradleAsync(gradlewFile, [
      'nxProjectGraph',
      `-Phash=${gradleConfigHash}`,
      '--no-configuration-cache', // disable configuration cache
      '--parallel', // add parallel to improve performance
      '--build-cache', // enable build cache
      '--warning-mode',
      'none',
      ...gradlePluginOptionsArgs,
      `-PworkspaceRoot=${workspaceRoot}`,
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
              `Could not run 'nxProjectGraph' task. Please run 'nx generate @nx/gradle:init' to add the necessary plugin dev.nx.gradle.project-graph.\n\r${e.toString()}`
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
