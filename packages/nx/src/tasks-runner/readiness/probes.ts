import { IS_WASM, LogMatcher, ReadinessProbe } from '../../native';
import type { RunningTask } from '../running-tasks/running-task';
import type { ReadySignalServer } from './ready-signal-server';
import { resolveStartupHost } from './startup-host';
import {
  notReadyError,
  ReadinessTimeoutError,
  readinessTimeoutError,
  type NormalizedReadyWhen,
} from './ready-when';

export interface ReadinessProbeContext {
  taskId: string;
  runningTask: RunningTask;
  cwd: string;
  signal: AbortSignal;
  readySignal?: ReadySignalServer;
}

// What the producer reported about itself, from a signal
export interface Readiness {
  url?: string;
}

type CheckReadyWhen = Exclude<NormalizedReadyWhen, { kind: 'signal' }>;

// Never rejects for a transient probe error: every failure is retried until
// the deadline.
export async function waitForReadiness(
  readyWhen: NormalizedReadyWhen,
  context: ReadinessProbeContext
): Promise<Readiness> {
  if (readyWhen.kind === 'signal') {
    return waitForSignal(readyWhen, context);
  }
  await waitForCheck(readyWhen, context);
  return {};
}

async function waitForCheck(
  readyWhen: CheckReadyWhen,
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
          : { command: readyWhen.command, env: readyWhen.env }),
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

// Ready on the producer's `ready` message, or on the fallback check until the
// producer says hello: from then on only its signal counts.
function waitForSignal(
  readyWhen: Extract<NormalizedReadyWhen, { kind: 'signal' }>,
  context: ReadinessProbeContext
): Promise<Readiness> {
  return new Promise<Readiness>((resolve, reject) => {
    const fallbackAbort = new AbortController();
    // A signal sent before the probe started is replayed during subscribe
    let unsubscribe = () => {};
    let settled = false;
    const settle = (error: Error | null, readiness?: Readiness) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      fallbackAbort.abort();
      context.signal.removeEventListener('abort', onAbort);
      error ? reject(error) : resolve(readiness);
    };
    const onAbort = () => settle(notReadyError(context.taskId, 'exited'));
    const timer = setTimeout(
      () => settle(readinessTimeoutError(context.taskId, readyWhen)),
      readyWhen.timeout
    );
    timer.unref();
    context.signal.addEventListener('abort', onAbort);
    if (context.signal.aborted) {
      onAbort();
      return;
    }
    const stop = context.readySignal?.subscribe(context.taskId, (message) => {
      if (message.type === 'nx-ready-signal:ready') {
        settle(null, message.url ? { url: message.url } : {});
      } else {
        fallbackAbort.abort();
      }
    });
    if (settled) {
      stop?.();
      return;
    }
    unsubscribe = stop ?? unsubscribe;
    // A replayed hello has already ruled the fallback out
    if (fallbackAbort.signal.aborted) {
      return;
    }
    if (readyWhen.fallback === null) {
      settle(null, {});
    } else if (readyWhen.fallback && !IS_WASM) {
      waitForCheck(readyWhen.fallback, {
        ...context,
        // settle aborts it when the producer exits
        signal: fallbackAbort.signal,
      }).then(
        () => {
          if (!fallbackAbort.signal.aborted) settle(null, {});
        },
        // Its timeout is the signal's, reported as one
        (e) => {
          if (fallbackAbort.signal.aborted) return;
          settle(
            e instanceof ReadinessTimeoutError
              ? readinessTimeoutError(context.taskId, readyWhen)
              : e
          );
        }
      );
    }
  });
}

function waitForLogMatch(
  readyWhen: Extract<CheckReadyWhen, { kind: 'logMatches' }>,
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
