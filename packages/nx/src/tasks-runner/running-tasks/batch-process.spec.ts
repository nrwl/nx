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
 * separate from what it captures internally for a failed batch.
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

const FOLDING_ENV = {
  GITHUB_ACTIONS: 'true',
  NX_SKIP_LOG_GROUPING: undefined,
  NX_STREAM_OUTPUT: undefined,
};

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

    const result = withEnvironmentVariables(FOLDING_ENV, () => {
      new BatchProcess(child, '@nx/js:tsc');
      return captureForwarded(() => {
        (child as any).stdout.emit('data', Buffer.from('out chunk'));
        (child as any).stderr.emit('data', Buffer.from('err chunk'));
      });
    });

    // Rendered from per-task terminalOutput (success) or the captured buffer
    // (failure) at batch end, never live — that would duplicate it outside the
    // fold.
    expect(result.stdout).toEqual('');
    expect(result.stderr).toEqual('');
  });

  it('captures both streams while folding, so a failed batch can surface them', () => {
    const child = fakeChildProcess();

    const batch = withEnvironmentVariables(FOLDING_ENV, () => {
      const b = new BatchProcess(child, '@nx/js:tsc');
      captureForwarded(() => {
        // Build log on stdout, the runner's own diagnostic on stderr — the
        // failed batch needs both, and neither is in any task's terminalOutput.
        (child as any).stdout.emit('data', Buffer.from('build log line\n'));
        (child as any).stderr.emit('data', Buffer.from('OutOfMemoryError\n'));
      });
      return b;
    });

    const captured = batch.getCapturedOutput();
    expect(captured).toContain('build log line');
    expect(captured).toContain('OutOfMemoryError');
  });

  it('does not capture anything when output is not being folded', () => {
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

    expect(batch.getCapturedOutput()).toEqual('');
  });

  it('caps the captured buffer so a long-lived batch cannot grow it without bound', () => {
    const child = fakeChildProcess();

    const batch = withEnvironmentVariables(FOLDING_ENV, () => {
      const b = new BatchProcess(child, '@nx/gradle:batch');
      captureForwarded(() => {
        // 3 MB in, well over the ~1 MB cap; the tail (the fatal) is what matters.
        for (let i = 0; i < 3; i++) {
          (child as any).stdout.emit(
            'data',
            Buffer.from('x'.repeat(1_000_000))
          );
        }
        (child as any).stderr.emit('data', Buffer.from('FINAL_FATAL'));
      });
      return b;
    });

    const captured = batch.getCapturedOutput();
    expect(captured.length).toBeLessThanOrEqual(1_000_000);
    // The most recent output — where the fatal lands — is retained.
    expect(captured).toContain('FINAL_FATAL');
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

    withEnvironmentVariables(FOLDING_ENV, () => {
      const batch = new BatchProcess(child, '@nx/js:tsc');
      batch.onOutput((o) => seen.push(o));
      captureForwarded(() => {
        (child as any).stdout.emit('data', Buffer.from('out chunk'));
      });
    });

    expect(seen).toEqual(['out chunk']);
  });
});
