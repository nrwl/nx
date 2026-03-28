import { AggregateCreateNodesError, output, workspaceRoot } from '@nx/devkit';
import { isCI } from 'nx/src/devkit-internals';
import { execGradleAsync, newLineSeparator } from '../../utils/exec-gradle';
import { GradlePluginOptions } from './gradle-plugin-options';

const DEFAULT_GRAPH_TIMEOUT_SECONDS = isCI() ? 600 : 180;

export function getGraphTimeoutMs(): number {
  const envTimeout = process.env.NX_GRADLE_PROJECT_GRAPH_TIMEOUT;
  if (envTimeout) {
    const parsed = Number(envTimeout);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed * 1000;
    }
  }
  return DEFAULT_GRAPH_TIMEOUT_SECONDS * 1000;
}

export async function getNxProjectGraphLines(
  gradlewFile: string,
  gradleConfigHash: string,
  gradlePluginOptions: GradlePluginOptions
): Promise<string[]> {
  let nxProjectGraphBuffer: Buffer;

  const gradlePluginOptionsArgs =
    Object.entries(gradlePluginOptions ?? {})?.map(
      ([key, value]) => `-P${key}=${value}`
    ) ?? [];

  const timeoutMs = getGraphTimeoutMs();
  const timeoutSeconds = timeoutMs / 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    nxProjectGraphBuffer = await execGradleAsync(
      gradlewFile,
      [
        'nxProjectGraph',
        `-Phash=${gradleConfigHash}`,
        '--no-configuration-cache', // disable configuration cache
        '--parallel', // add parallel to improve performance
        '--build-cache', // enable build cache
        '--warning-mode',
        'none',
        ...gradlePluginOptionsArgs,
        `-PworkspaceRoot=${workspaceRoot}`,
        process.env.NX_GRADLE_VERBOSE_LOGGING ? '--info' : '',
      ],
      { signal: controller.signal }
    );
  } catch (e: any) {
    if (controller.signal.aborted) {
      throw new AggregateCreateNodesError(
        [
          [
            gradlewFile,
            new Error(
              `Gradle project graph generation timed out after ${timeoutSeconds} ${timeoutSeconds === 1 ? 'second' : 'seconds'}.\n` +
                `  1. Run "gradlew --stop" to stop the Gradle daemon, then run "gradlew clean" to clear the build cache.\n` +
                `  2. If the issue persists, set the environment variable NX_GRADLE_PROJECT_GRAPH_TIMEOUT to a higher value (in seconds) to increase the timeout.\n` +
                `  3. If the issue still persists, set NX_GRADLE_DISABLE=true to disable the Gradle plugin entirely.`
            ),
          ],
        ],
        []
      );
    } else if (e.toString()?.includes('ERROR: JAVA_HOME')) {
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
  } finally {
    clearTimeout(timer);
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
