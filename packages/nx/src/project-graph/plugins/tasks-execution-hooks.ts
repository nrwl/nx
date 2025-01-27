import type {
  PostTasksExecutionContext,
  PreTasksExecutionContext,
} from './public-api';
import { getPlugins } from './get-plugins';
import { isOnDaemon } from '../../daemon/is-on-daemon';
import { daemonClient, isDaemonEnabled } from '../../daemon/client/client';

export async function runPreTasksExecution(
  pluginContext: PreTasksExecutionContext
) {
  if (isOnDaemon() || !isDaemonEnabled()) {
    performance.mark(`preTasksExecution:start`);
    const plugins = await getPlugins(pluginContext.workspaceRoot);
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
  if (isOnDaemon() || !isDaemonEnabled()) {
    performance.mark(`postTasksExecution:start`);
    const plugins = await getPlugins();
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
