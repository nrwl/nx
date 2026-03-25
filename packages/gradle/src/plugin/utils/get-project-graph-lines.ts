import { AggregateCreateNodesError, output, workspaceRoot } from '@nx/devkit';
import { execGradleAsync, newLineSeparator } from '../../utils/exec-gradle';
import { GradlePluginOptions } from './gradle-plugin-options';

const DEFAULT_GRAPH_TIMEOUT_SECONDS = 30;

class GradleGraphTimeoutError extends Error {
  constructor(public readonly seconds: number) {
    super(`Timed out after ${seconds}s`);
  }
}

export function getGraphTimeoutMs(): number | undefined {
  if (process.env.NX_PLUGIN_NO_TIMEOUTS === 'true') {
    return undefined;
  }
  const envTimeout = process.env.NX_GRADLE_GRAPH_TIMEOUT;
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
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const gradlePromise = execGradleAsync(
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

    if (timeoutMs !== undefined) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new GradleGraphTimeoutError(timeoutMs / 1000));
        }, timeoutMs);
      });
      gradlePromise.catch(() => {});
      nxProjectGraphBuffer = await Promise.race([
        gradlePromise,
        timeoutPromise,
      ]);
    } else {
      nxProjectGraphBuffer = await gradlePromise;
    }
  } catch (e: any) {
    if (e instanceof GradleGraphTimeoutError) {
      throw new AggregateCreateNodesError(
        [
          [
            gradlewFile,
            new Error(
              `Gradle project graph generation timed out after ${e.seconds} seconds.\n` +
                `To increase the timeout, set the environment variable NX_GRADLE_GRAPH_TIMEOUT to a higher value (in seconds).\n` +
                `To disable the Gradle plugin entirely, set NX_GRADLE_DISABLE=true.`
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
    if (timer) clearTimeout(timer);
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
