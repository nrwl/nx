import type {
  PostTasksExecutionContext,
  PreTasksExecutionContext,
} from './public-api';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import { getPlugins, peekPluginCapabilities } from './get-plugins';
import { isOnDaemon } from '../../daemon/is-on-daemon';
import { daemonClient, isDaemonEnabled } from '../../daemon/client/client';
import { workspaceRoot } from '../../utils/workspace-root';
import type { PluginCapabilities } from './capabilities-cache';

/**
 * True when the records prove that no plugin registers `hook`. False when one
 * does, and false when any plugin has no record, since then only loading can
 * tell.
 */
async function noPluginRegisters(
  hook: keyof Pick<
    PluginCapabilities,
    'hasPreTasksExecution' | 'hasPostTasksExecution'
  >,
  nxJson: NxJsonConfiguration,
  root: string
): Promise<boolean> {
  const recorded = await peekPluginCapabilities(nxJson, root);
  return !!recorded && !recorded.some((capabilities) => capabilities[hook]);
}

export async function runPreTasksExecution(
  pluginContext: PreTasksExecutionContext
) {
  const nxJson = readNxJson(pluginContext.workspaceRoot);

  // Checked before the daemon branch, so a workspace whose plugins register no
  // hook neither loads them nor pays for the round trip.
  if (
    await noPluginRegisters(
      'hasPreTasksExecution',
      nxJson,
      pluginContext.workspaceRoot
    )
  ) {
    return [];
  }

  if (isOnDaemon() || !isDaemonEnabled()) {
    performance.mark(`preTasksExecution:start`);
    const plugins = await getPlugins(nxJson, pluginContext.workspaceRoot);
    const envs = await Promise.all(
      plugins
        .filter((p) => p.preTasksExecution)
        .map(async (plugin) => {
          performance.mark(`${plugin.name}:preTasksExecution:start`);
          try {
            return await plugin.preTasksExecution(pluginContext);
          } finally {
            performance.mark(`${plugin.name}:preTasksExecution:end`);
            performance.measure(
              `${plugin.name}:preTasksExecution`,
              `${plugin.name}:preTasksExecution:start`,
              `${plugin.name}:preTasksExecution:end`
            );
          }
        })
    );

    if (!isDaemonEnabled()) {
      applyProcessEnvs(envs);
    }
    performance.mark(`preTasksExecution:end`);
    performance.measure(
      `preTasksExecution`,
      `preTasksExecution:start`,
      `preTasksExecution:end`
    );
    return envs;
  } else {
    const envs = await daemonClient.runPreTasksExecution(pluginContext);
    applyProcessEnvs(envs);
  }
}

function applyProcessEnvs(envs: NodeJS.ProcessEnv[]) {
  for (const env of envs) {
    for (const key in env) {
      process.env[key] = env[key];
    }
  }
}

export async function runPostTasksExecution(
  context: PostTasksExecutionContext
) {
  const nxJson = readNxJson(workspaceRoot);

  // Checked before the daemon branch, because `context` carries every task's
  // result including its terminal output, and that is what would cross the
  // socket to reach plugins that do not want it.
  if (await noPluginRegisters('hasPostTasksExecution', nxJson, workspaceRoot)) {
    return;
  }

  if (isOnDaemon() || !isDaemonEnabled()) {
    performance.mark(`postTasksExecution:start`);
    const plugins = await getPlugins(nxJson);
    await Promise.all(
      plugins
        .filter((p) => p.postTasksExecution)
        .map(async (plugin) => {
          performance.mark(`${plugin.name}:postTasksExecution:start`);
          try {
            await plugin.postTasksExecution(context);
          } finally {
            performance.mark(`${plugin.name}:postTasksExecution:end`);
            performance.measure(
              `${plugin.name}:postTasksExecution`,
              `${plugin.name}:postTasksExecution:start`,
              `${plugin.name}:postTasksExecution:end`
            );
          }
        })
    );
    performance.mark(`postTasksExecution:end`);
    performance.measure(
      `postTasksExecution`,
      `postTasksExecution:start`,
      `postTasksExecution:end`
    );
  } else {
    await daemonClient.runPostTasksExecution(context);
  }
}
