import type { PluginConfiguration } from '../../../config/nx-json';
import { isAiAgent } from '../../../native';
import { sandboxSocketHint } from '../../../daemon/sandbox-socket-hint';
import { isSandbox } from '../../../utils/is-sandbox';
import { output } from '../../../utils/output';
import { loadNxPlugin } from '../in-process-loader';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';

import {
  isPluginWorkerSocketRefusal,
  isPluginWorkerStartupFailure,
} from './isolated-plugin';

/**
 * Set once a worker has been refused in this process, and read by every later
 * plugin: nothing about a second attempt can succeed once the first has been
 * refused for a reason that belongs to the sandbox.
 *
 * Process-scoped rather than persisted: the refusal describes the environment
 * Nx is running in, so it must not follow the workspace into a plain terminal.
 */
let isolationRefusedInThisProcess = false;

export function isolationRefused(): boolean {
  return isolationRefusedInThisProcess;
}

/** Exported for tests: the fallback latch is process-scoped by design. */
export function resetIsolationFallbackForTesting() {
  isolationRefusedInThisProcess = false;
}

/**
 * The plugin loaded in this process, when a worker failure is one to degrade
 * for, and null when it is one to report.
 *
 * Called from wherever a worker is started, which is two places: the load, and
 * the first hook call on a plugin wired from a capability record. A sandbox that
 * denies the worker's socket denies it just as much the second way, and a
 * command that used to warn and carry on must not start failing because the
 * records happened to be warm.
 */
export async function pluginWithoutWorker(
  e: unknown,
  plugin: PluginConfiguration,
  root: string,
  index?: number
): Promise<LoadedNxPlugin | null> {
  // Proof, kept separate from policy. The errno the worker saw is what makes
  // the message certain; whether that errno is also grounds for degrading is a
  // different question, and conflating them made the warning assert a sandbox
  // for agents the hint itself declines to name.
  const provenRefusal = isPluginWorkerSocketRefusal(e);
  // An agent is required alongside the errno, so a refusal on an ordinary
  // workstation still surfaces rather than silently losing isolation.
  if (
    !isPluginWorkerStartupFailure(e) ||
    !((provenRefusal && isAiAgent()) || isSandbox())
  ) {
    return null;
  }

  // Read and set in one synchronous step. Concurrently loaded plugins each
  // arrive here with their own failure, so testing the latch after setting it
  // is what keeps the advice to one copy.
  const alreadyRefused = isolationRefusedInThisProcess;
  isolationRefusedInThisProcess = true;
  if (!alreadyRefused) {
    output.warn({
      // Names what Nx observed, not what it infers. `isAiAgent()` is broader
      // than the agents `sandboxSpecificRemedy` will name a setting for, so a
      // title asserting a sandbox could sit above a body that deliberately
      // does not.
      title: provenRefusal
        ? 'Nx was denied permission to create a plugin worker socket. Running plugins in the main process instead.'
        : 'Could not start a plugin worker. Running plugins in the main process instead.',
      bodyLines: [
        'Plugins that expect isolation may misbehave, and this is slower than a worker.',
        // `certain` on the errno alone. Reaching here via `isSandbox()` proves
        // only that a worker died before it connected, which denied permission
        // explains but so does an OOM kill or a broken install.
        ...sandboxSocketHint({ certain: provenRefusal }),
      ],
    });
  }

  return loadNxPlugin(plugin, root, index);
}
