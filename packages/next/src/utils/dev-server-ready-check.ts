import {
  getForwardedArgs,
  getServerAddress,
  runReadyCheck,
  type ServerAddress,
} from '@nx/devkit/internal';

/**
 * Where `next dev` and `next start` listen, given the task's options and env.
 */
export function getNextServerAddress(
  options: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): ServerAddress | null {
  const args = getForwardedArgs(options);
  const flags: { port?: string; hostname?: string } = {};
  const set = (name: string, value: string | undefined) => {
    if (name === '-p' || name === '--port') flags.port = value;
    if (name === '-H' || name === '--hostname') flags.hostname = value;
  };
  for (let i = 0; i < args.length && args[i] !== '--'; i++) {
    const arg = args[i];
    const equals = arg.indexOf('=');
    if (/^-[pH]./.test(arg)) {
      set(arg.slice(0, 2), arg.slice(2));
    } else if (arg.startsWith('--') && equals !== -1) {
      set(arg.slice(0, equals), arg.slice(equals + 1));
    } else if (['-p', '--port', '-H', '--hostname'].includes(arg)) {
      set(arg, args[++i]);
    }
  }
  // Next.js 14.1 falls back to 3000 on a non-numeric PORT, 14.2+ exits
  const envPort = parseInt(env.PORT, 10);
  const port =
    flags.port !== undefined
      ? parseInt(flags.port, 10)
      : Number.isNaN(envPort)
        ? 3000
        : envPort;
  return getServerAddress(port, flags.hostname);
}

/**
 * The readyWhen of the inferred `next dev` and `next start` targets. Runs in
 * the env and with the options of the task, and waits for the server's port.
 */
export async function waitForNextServer() {
  await runReadyCheck(async ({ options }) => {
    const address = getNextServerAddress(options, process.env);
    return address ? [address] : null;
  });
}
