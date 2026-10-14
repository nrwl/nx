import { BlockList } from 'net';
import { networkInterfaces } from 'os';
import { IS_WASM, LogMatcher, ReadinessProbe } from '../../native';
import type { RunningTask } from '../running-tasks/running-task';
import {
  notReadyError,
  readinessTimeoutError,
  type NormalizedReadyWhen,
} from './ready-when';

export interface ReadinessProbeContext {
  taskId: string;
  runningTask: RunningTask;
  cwd: string;
  signal: AbortSignal;
}

// Never rejects for a transient probe error: every failure is retried until
// the deadline.
export async function waitForReadiness(
  readyWhen: NormalizedReadyWhen,
  context: ReadinessProbeContext
): Promise<void> {
  if (IS_WASM) {
    throw new Error(
      `The WASM build of Nx does not support "readyWhen", so "${context.taskId}" cannot be probed for readiness.`
    );
  }
  if (readyWhen.kind === 'logMatches') {
    return waitForLogMatch(readyWhen, context);
  }

  const probe = new ReadinessProbe(
    {
      timeout: readyWhen.timeout,
      interval: readyWhen.interval,
      ...(readyWhen.kind === 'url'
        ? { url: readyWhen.url }
        : readyWhen.kind === 'port'
          ? { port: readyWhen.port, host: resolveStartupHost(readyWhen.host) }
          : { command: readyWhen.command }),
    },
    context.cwd
  );
  const cancel = () => probe.cancel();
  context.signal.addEventListener('abort', cancel);
  if (context.signal.aborted) {
    probe.cancel();
  }
  let ready: boolean;
  try {
    ready = await probe.wait();
  } finally {
    context.signal.removeEventListener('abort', cancel);
  }
  if (!ready) {
    throw context.signal.aborted
      ? notReadyError(context.taskId, 'exited')
      : readinessTimeoutError(context.taskId, readyWhen);
  }
}

// webpack-dev-server and the Rspack dev server resolve these hosts when they
// start (`Server.getHostname`). A wildcard fallback means loopback to the probe.
function resolveStartupHost(host: string | undefined): string | undefined {
  switch (host) {
    case 'local-ip':
      return findIp('IPv4') ?? findIp('IPv6') ?? '0.0.0.0';
    case 'local-ipv4':
      return findIp('IPv4') ?? '0.0.0.0';
    case 'local-ipv6':
      return findIp('IPv6') ?? '::';
    default:
      return host;
  }
}

// The IPv6 ranges `Server.findIp` accepts: unique local, IPv4-mapped, loopback
const FIND_IP_V6_RANGES = new BlockList();
FIND_IP_V6_RANGES.addSubnet('fc00::', 7, 'ipv6');
FIND_IP_V6_RANGES.addSubnet('::ffff:0:0', 96, 'ipv6');
FIND_IP_V6_RANGES.addAddress('::1', 'ipv6');

function findIp(family: 'IPv4' | 'IPv6'): string | undefined {
  return Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .find(
      ({ address, family: addressFamily, internal }) =>
        address &&
        addressFamily === family &&
        !internal &&
        (family === 'IPv4' || FIND_IP_V6_RANGES.check(address, 'ipv6'))
    )?.address;
}

function waitForLogMatch(
  readyWhen: Extract<NormalizedReadyWhen, { kind: 'logMatches' }>,
  context: ReadinessProbeContext
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const matcher = new LogMatcher(readyWhen.logMatches);
    let settled = false;
    const settle = (error?: Error) => {
      settled = true;
      clearTimeout(timer);
      context.signal.removeEventListener('abort', onAbort);
      error ? reject(error) : resolve();
    };
    const onAbort = () => settle(notReadyError(context.taskId, 'exited'));
    const timer = setTimeout(
      () => settle(readinessTimeoutError(context.taskId, readyWhen)),
      readyWhen.timeout
    );
    timer.unref();
    context.signal.addEventListener('abort', onAbort);
    context.runningTask.onOutput((chunk) => {
      if (!settled && matcher.feed(chunk)) {
        settle();
      }
    });
  });
}
