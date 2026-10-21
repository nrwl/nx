import {
  getServerAddress,
  runReadyCheck,
  type ServerAddress,
} from '@nx/devkit/internal';

/**
 * Where `react-router-serve` listens: on PORT and HOST from its env, or on
 * 3000 when PORT is unset and 3000 is free.
 */
export function getReactRouterServeAddress(
  env: NodeJS.ProcessEnv
): ServerAddress | null {
  // react-router-serve reads PORT with Number() and ignores only NaN, so an
  // empty PORT is port 0, which the server picks
  const port = Number(env.PORT);
  return getServerAddress(Number.isNaN(port) ? 3000 : port, env.HOST);
}

/**
 * The readyWhen of the inferred `react-router-serve` target. Runs in the env of
 * the task and waits for the server's port.
 */
export async function waitForReactRouterServe() {
  await runReadyCheck(async () => {
    const address = getReactRouterServeAddress(process.env);
    return address ? [address] : null;
  });
}
