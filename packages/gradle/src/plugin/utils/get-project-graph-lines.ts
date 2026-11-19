import { AggregateCreateNodesError, output, workspaceRoot } from '@nx/devkit';
import { execGradleAsync, newLineSeparator } from '../../utils/exec-gradle';
import { GradlePluginOptions } from './gradle-plugin-options';
import { isCI } from '@nx/devkit/internal';

const DEFAULT_GRAPH_TIMEOUT_SECONDS = isCI() ? 600 : 120;
// setTimeout silently clamps a delay past the 32-bit signed max to 1ms, which
// would abort immediately — the opposite of what a large value asks for.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
const GRADLE_LOCK_TIMEOUT_MESSAGE = 'Timeout waiting to lock';
// Gradle gives up on a contended lock (e.g. buildLogic.lock held by another
// build in the same project) after ~60s, so at the 120s local default one wait
// consumes the budget and the deadline guard below refuses a retry; retries
// engage on CI (600s) or a raised NX_GRADLE_PROJECT_GRAPH_TIMEOUT. Do not relax
// that `>=` to `>` — it refuses the borderline attempt rather than letting the
// abort fire mid-retry and replace the lock message with a generic timeout.
const MAX_LOCK_TIMEOUT_RETRIES = 2;

let currentAbortController: AbortController | undefined;

/**
 * Cancel any in-flight Gradle project graph process.
 * Safe to call even if nothing is running.
 */
export function cancelPendingProjectGraphRequest(): void {
  if (currentAbortController) {
    currentAbortController.abort('cancelled');
    currentAbortController = undefined;
  }
}

export function getGraphTimeoutMs(): number {
  const envTimeout = process.env.NX_GRADLE_PROJECT_GRAPH_TIMEOUT;
  if (envTimeout) {
    const parsed = Number(envTimeout);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return Math.min(parsed * 1000, MAX_TIMEOUT_MS);
    }
  }
  return DEFAULT_GRAPH_TIMEOUT_SECONDS * 1000;
}

function isGradleLockTimeout(e: unknown): boolean {
  return String(e).includes(GRADLE_LOCK_TIMEOUT_MESSAGE);
}

async function execGradleWithLockRetry(
  gradlewFile: string,
  args: string[],
  signal: AbortSignal,
  deadline: number
): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    const attemptStart = Date.now();
    try {
      return await execGradleAsync(gradlewFile, args, { signal });
    } catch (e) {
      if (
        signal.aborted ||
        attempt >= MAX_LOCK_TIMEOUT_RETRIES ||
        !isGradleLockTimeout(e)
      ) {
        throw e;
      }
      // Retry only if another full lock wait still fits in the graph timeout.
      // Otherwise the timeout aborts mid-attempt and its generic message
      // replaces the lock guidance the user actually needs.
      const lockWaitMs = Date.now() - attemptStart;
      if (Date.now() + lockWaitMs >= deadline) {
        throw e;
      }
      output.warn({
        title: `Gradle lock is held by another build; retrying 'nxProjectGraph' (${attempt + 1}/${MAX_LOCK_TIMEOUT_RETRIES})`,
      });
    }
  }
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
  const deadline = Date.now() + timeoutMs;

  // Cancel any in-flight Gradle process from a previous call, then create a fresh controller.
  cancelPendingProjectGraphRequest();
  const controller = new AbortController();
  currentAbortController = controller;
  const signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const args = [
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
  ];

  try {
    nxProjectGraphBuffer = await execGradleWithLockRetry(
      gradlewFile,
      args,
      signal,
      deadline
    );
  } catch (e: any) {
    // Cancelled by a newer populateProjectGraph call — let the caller handle it
    if (signal.reason === 'cancelled') {
      throw new Error('Gradle project graph generation was cancelled');
    }
    if (signal.aborted) {
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
    } else if (isGradleLockTimeout(e)) {
      throw new AggregateCreateNodesError(
        [
          [
            gradlewFile,
            new Error(
              `Could not run 'nxProjectGraph' Gradle task because another Gradle build is holding a lock on the project.\n` +
                `  Wait for the other build to finish, or run "gradlew --stop" to stop stale Gradle daemons, then try again.\n\r${e.toString()}`
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
