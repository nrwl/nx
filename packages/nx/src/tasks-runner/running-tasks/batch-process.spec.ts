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
  it('forwards batch output live when grouping does not apply', () => {
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

  it('suppresses the live copy when batch output is being folded', () => {
    const child = fakeChildProcess();

    const result = withEnvironmentVariables(
      {
        GITHUB_ACTIONS: 'true',
        NX_SKIP_LOG_GROUPING: undefined,
        NX_STREAM_OUTPUT: undefined,
      },
      () => {
        new BatchProcess(child, '@nx/js:tsc');
        return captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('out chunk'));
          (child as any).stderr.emit('data', Buffer.from('err chunk'));
        });
      }
    );

    // The grouped per-task block is the canonical copy here, so nothing is
    // forwarded live — that would duplicate it outside the group.
    expect(result.stdout).toEqual('');
    expect(result.stderr).toEqual('');
  });

  it('retains folded stderr so a crash can still be surfaced', () => {
    const child = fakeChildProcess();

    const batch = withEnvironmentVariables(
      {
        GITHUB_ACTIONS: 'true',
        NX_SKIP_LOG_GROUPING: undefined,
        NX_STREAM_OUTPUT: undefined,
      },
      () => {
        const b = new BatchProcess(child, '@nx/js:tsc');
        captureForwarded(() => {
          (child as any).stderr.emit('data', Buffer.from('Fatal: worker died'));
        });
        return b;
      }
    );

    // Held back from the live stream, but available for the orchestrator to
    // print if the batch exits without per-task results.
    expect(batch.getCapturedErrorOutput()).toContain('Fatal: worker died');
  });

  it('does not capture stderr when output is not being folded', () => {
    const child = fakeChildProcess();

    const batch = withEnvironmentVariables(
      { GITHUB_ACTIONS: undefined, NX_SKIP_LOG_GROUPING: undefined },
      () => {
        const b = new BatchProcess(child, '@nx/js:tsc');
        captureForwarded(() => {
          (child as any).stderr.emit('data', Buffer.from('err chunk'));
        });
        return b;
      }
    );

    expect(batch.getCapturedErrorOutput()).toEqual('');
  });

  it('forwards live when the user explicitly asked to stream, even under grouping', () => {
    const child = fakeChildProcess();

    const result = withEnvironmentVariables(
      {
        GITHUB_ACTIONS: 'true',
        NX_SKIP_LOG_GROUPING: undefined,
        NX_STREAM_OUTPUT: 'true',
      },
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

  it('forwards live when NX_SKIP_LOG_GROUPING is set', () => {
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

  it('still reports output to callbacks while folding', () => {
    const child = fakeChildProcess();
    const seen: string[] = [];

    withEnvironmentVariables(
      {
        GITHUB_ACTIONS: 'true',
        NX_SKIP_LOG_GROUPING: undefined,
        NX_STREAM_OUTPUT: undefined,
      },
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
});
