import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import { BatchProcess } from './batch-process';

function fakeChildProcess() {
  const child = new EventEmitter() as unknown as ChildProcess & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  (child as any).stdout = new EventEmitter();
  (child as any).stderr = new EventEmitter();
  return child;
}

/**
 * Captures what the batch process forwards to the parent's terminal, which is
 * separate from what it reports back as the task's terminalOutput.
 */
function captureForwarded(cb: () => void): { stdout: string; stderr: string } {
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  let stdout = '';
  let stderr = '';
  process.stdout.write = ((chunk: any) => {
    stdout += chunk;
    return true;
  }) as any;
  process.stderr.write = ((chunk: any) => {
    stderr += chunk;
    return true;
  }) as any;
  try {
    cb();
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
  return { stdout, stderr };
}

describe('BatchProcess', () => {
  it('forwards batch output to the terminal when grouping does not apply', () => {
    const child = fakeChildProcess();

    const result = withEnvironmentVariables(
      { GITHUB_ACTIONS: undefined, NX_SKIP_LOG_GROUPING: undefined },
      () => {
        new BatchProcess(child, '@nx/js:tsc');
        return captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('out chunk'));
          (child as any).stderr.emit('data', Buffer.from('err chunk'));
        });
      }
    );

    expect(result.stdout).toContain('out chunk');
    expect(result.stderr).toContain('err chunk');
  });

  it('does not forward batch output when it would land outside the log group', () => {
    const child = fakeChildProcess();

    const result = withEnvironmentVariables(
      { GITHUB_ACTIONS: 'true', NX_SKIP_LOG_GROUPING: undefined },
      () => {
        new BatchProcess(child, '@nx/js:tsc');
        return captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('out chunk'));
          (child as any).stderr.emit('data', Buffer.from('err chunk'));
        });
      }
    );

    // Batch executors report this same text back as the task's terminalOutput,
    // so forwarding it here would duplicate it and place the copy outside the
    // task's ::group:: block.
    expect(result.stdout).toEqual('');
    expect(result.stderr).toEqual('');
  });

  it('still reports output to callbacks when forwarding is suppressed', () => {
    const child = fakeChildProcess();
    const seen: string[] = [];

    withEnvironmentVariables(
      { GITHUB_ACTIONS: 'true', NX_SKIP_LOG_GROUPING: undefined },
      () => {
        const batch = new BatchProcess(child, '@nx/js:tsc');
        batch.onOutput((o) => seen.push(o));
        captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('out chunk'));
        });
      }
    );

    expect(seen).toEqual(['out chunk']);
  });

  it('forwards batch output when NX_SKIP_LOG_GROUPING is set', () => {
    const child = fakeChildProcess();

    const result = withEnvironmentVariables(
      { GITHUB_ACTIONS: 'true', NX_SKIP_LOG_GROUPING: 'true' },
      () => {
        new BatchProcess(child, '@nx/js:tsc');
        return captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('out chunk'));
        });
      }
    );

    expect(result.stdout).toContain('out chunk');
  });
});
