import {
  AggregateCreateNodesError,
  logger,
  output,
  workspaceRoot,
} from '@nx/devkit';
import { execGradleAsync, newLineSeparator } from '../../utils/exec-gradle';
import { GradlePluginOptions } from './gradle-plugin-options';

const DEFAULT_GRAPH_TIMEOUT_SECONDS = 30;

class NxGradleProjectGraphGenerationError extends Error {
  constructor(public readonly seconds: number) {
    super(
      `Project graph generation timed out after ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
    );
  }
}

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

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new NxGradleProjectGraphGenerationError(timeoutMs / 1000));
      }, timeoutMs);
    });
    gradlePromise.catch((e) => {
      logger.verbose(`Gradle process terminated after abort signal: ${e}`);
    });
    nxProjectGraphBuffer = await Promise.race([gradlePromise, timeoutPromise]);
  } catch (e: any) {
    if (e instanceof NxGradleProjectGraphGenerationError) {
      throw new AggregateCreateNodesError(
        [
          [
            gradlewFile,
            new Error(
              `Gradle project graph generation timed out after ${e.seconds} ${e.seconds === 1 ? 'second' : 'seconds'}. \n` +
                `  - Run "gradlew --stop" to stop the Gradle daemon and "gradlew clean" to clear the build cache\n` +
                `  - Set the environment variable NX_GRADLE_PROJECT_GRAPH_TIMEOUT to a higher value (in seconds) to increase the timeout\n` +
                `  - Set NX_GRADLE_DISABLE=true to disable the Gradle plugin entirely`
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
