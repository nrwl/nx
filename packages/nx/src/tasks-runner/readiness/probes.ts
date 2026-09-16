import { LogMatcher, ProbeOutcome, ReadinessProbe } from '../../native';
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
  const timedOut = () => readinessTimeoutError(context.taskId, readyWhen);
  const exited = () => notReadyError(context.taskId, 'exited');

  if (readyWhen.kind === 'logMatches') {
    return waitForLogMatch(readyWhen, context, timedOut, exited);
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
  let outcome: ProbeOutcome;
  try {
    outcome = await probe.wait();
  } finally {
    context.signal.removeEventListener('abort', cancel);
  }
  switch (outcome) {
    case ProbeOutcome.Ready:
      return;
    case ProbeOutcome.TimedOut:
      throw timedOut();
    case ProbeOutcome.Cancelled:
      throw exited();
  }
}

function waitForLogMatch(
  readyWhen: Extract<NormalizedReadyWhen, { kind: 'logMatches' }>,
  context: ReadinessProbeContext,
  timedOut: () => Error,
  exited: () => Error
): Promise<void> {
  if (!context.runningTask.onOutput) {
    return Promise.reject(
      new Error(
        `Task "${context.taskId}" declares "readyWhen.logMatches" but its output is not captured.`
      )
    );
  }
  return new Promise<void>((resolve, reject) => {
    const matcher = new LogMatcher(readyWhen.logMatches);
    let settled = false;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.signal.removeEventListener('abort', onAbort);
      error ? reject(error) : resolve();
    };
    const onAbort = () => settle(exited());
    const timer = setTimeout(() => settle(timedOut()), readyWhen.timeout);
    timer.unref();
    context.signal.addEventListener('abort', onAbort);
    context.runningTask.onOutput((chunk) => {
      if (!settled && matcher.feed(chunk)) {
        settle();
      }
    });
  });
}
