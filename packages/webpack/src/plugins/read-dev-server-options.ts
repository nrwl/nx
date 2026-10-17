import { readWebpackOptions } from '../utils/webpack/read-webpack-options';
import { resolveUserDefinedWebpackConfig } from '../utils/webpack/resolve-user-defined-webpack-config';

export interface DevServerOptions {
  devServer?: { port?: unknown; host?: unknown; ipc?: unknown };
  infrastructureLogging: { level?: string; console: boolean; stream: boolean };
}

/**
 * Reads each config the way `webpack-cli serve` does, calling a function
 * config with its serve env. It runs under a serve task's env (see
 * `evaluateUnderTaskEnv`), so it returns only plain values.
 */
export async function readDevServerOptions(
  configPath: string,
  tsConfig: string
): Promise<DevServerOptions[]> {
  const env = { WEBPACK_SERVE: true };
  const configs = await readWebpackOptions(
    resolveUserDefinedWebpackConfig(configPath, tsConfig, true),
    env,
    { env }
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
