import { readRspackOptions } from '../utils/read-rspack-options';
import { resolveUserDefinedRspackConfig } from '../utils/resolve-user-defined-rspack-config';

export interface DevServerOptions {
  devServer?: { port?: unknown; host?: unknown; ipc?: unknown };
  infrastructureLogging: { level?: string; console: boolean; stream: boolean };
}

/**
 * Reads each config the way `rspack serve --node-env=<nodeEnv>` does, calling
 * a function config with its serve env and argv. It runs under a serve task's
 * env (see `evaluateUnderTaskEnv`), so it returns only plain values.
 */
export async function readDevServerOptions(
  configPath: string,
  tsConfig: string,
  nodeEnv: string
): Promise<DevServerOptions[]> {
  const env = { RSPACK_SERVE: true };
  const configs = await readRspackOptions(
    await resolveUserDefinedRspackConfig(configPath, tsConfig, true),
    env,
    { env, nodeEnv }
  );
  return configs.map(({ devServer, infrastructureLogging: logging = {} }) => ({
    devServer: devServer
      ? { port: devServer.port, host: devServer.host, ipc: devServer.ipc }
      : undefined,
    infrastructureLogging: {
      level: logging.level,
      console: !!logging.console,
      stream: !!logging.stream,
    },
  }));
}
