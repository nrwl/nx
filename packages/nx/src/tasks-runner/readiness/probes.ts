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
          ? { port: readyWhen.port, host: readyWhen.host }
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
