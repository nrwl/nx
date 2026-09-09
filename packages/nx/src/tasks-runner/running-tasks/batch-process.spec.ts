import * as figures from 'figures';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { existsSync, readFileSync } from 'fs';

// Fails the capture stream on its first write - a full disk. Gated on a flag so
// every other test here keeps the real fs.
//
// A spy would also work, but only through `require('fs')` - NOT through an
// `import * as fs`, which under this repo's transform is an interop wrapper
// around the module rather than the module object itself, so mutating it
// changes nothing the capture can see. The module mock sidesteps the
// distinction entirely.
let mockFailWriteStream = false;
vi.mock('fs', async () => {
  const actual = require('fs');
  return {
    ...actual,
    createWriteStream: (...args: unknown[]) => {
      const stream = (actual.createWriteStream as any)(...args);
      if (mockFailWriteStream) {
        const write = stream.write.bind(stream);
        stream.write = (chunk: any) => {
          // Asynchronous, like the real thing: the write is accepted and the
          // failure arrives as an 'error' event afterwards.
          setImmediate(() =>
            stream.emit(
              'error',
              Object.assign(new Error('ENOSPC: no space left on device'), {
                code: 'ENOSPC',
              })
            )
          );
          return write(chunk);
        };
      }
      return stream;
    },
  };
});
import { stripVTControlCharacters } from 'util';
import type { ChildProcess } from 'child_process';
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import { output } from '../../utils/output';
import { BatchProcess } from './batch-process';

function fakeChildProcess() {
  const child = new EventEmitter() as unknown as ChildProcess & {
    stdout: PassThrough;
    stderr: PassThrough;
  };
  // Real streams, not bare emitters: the capture pauses the source when the
  // file's write buffer fills, so a double without `pause`/`resume` would pass
  // tests that production cannot reach.
  (child as any).stdout = new PassThrough();
  (child as any).stderr = new PassThrough();
  return child;
}

/**
 * Captures what the batch process forwards to the parent's terminal, which is
 * separate from what it captures internally for the fold renderings.
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

  it('captures both streams while folding, so the fold can surface them', async () => {
    const child = fakeChildProcess();

    const batch = withEnvironmentVariables(FOLDING_ENV, () => {
      const b = new BatchProcess(child, '@nx/js:tsc');
      captureForwarded(() => {
        // Build log on stdout, the runner's own diagnostic on stderr — the
        // fold needs both, and neither is in any task's terminalOutput.
        (child as any).stdout.emit('data', Buffer.from('build log line\n'));
        (child as any).stderr.emit('data', Buffer.from('OutOfMemoryError\n'));
      });
      return b;
    });

    await batch.flushCapturedOutput();
    const captured = readFileSync(batch.getCapturedOutputPath(), 'utf-8');
    expect(captured).toContain('build log line');
    expect(captured).toContain('OutOfMemoryError');
    batch.discardCapturedOutput();
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

    expect(batch.getCapturedOutputPath()).toBeUndefined();
  });

  it('captures a batch log without capping it, keeping the head', async () => {
    const child = fakeChildProcess();

    const batch = withEnvironmentVariables(FOLDING_ENV, () => {
      const b = new BatchProcess(child, '@nx/gradle:batch');
      captureForwarded(() => {
        // 3 MB in. Nothing is dropped and, unlike the tail-capped version this
        // replaced, the head survives - that is where a compiler's first,
        // non-cascading errors are.
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

    await batch.flushCapturedOutput();
    const captured = readFileSync(batch.getCapturedOutputPath(), 'utf-8');
    expect(captured.length).toEqual(3_000_000 + 'FINAL_FATAL'.length);
    // Both the head, where a compiler's first errors land, and the tail, where
    // a runner's fatal lands, survive.
    expect(captured.startsWith('x')).toBe(true);
    expect(captured).toContain('FINAL_FATAL');
    batch.discardCapturedOutput();
  });

  it('holds the captured log on disk rather than in memory', async () => {
    const child = fakeChildProcess();

    const batch = withEnvironmentVariables(FOLDING_ENV, () => {
      const b = new BatchProcess(child, '@nx/gradle:batch');
      captureForwarded(() => {
        (child as any).stdout.emit('data', Buffer.from('build log line\n'));
      });
      return b;
    });

    await batch.flushCapturedOutput();
    const path = batch.getCapturedOutputPath();
    expect(path).toBeDefined();
    expect(existsSync(path)).toBe(true);

    batch.discardCapturedOutput();
    // Left behind, a batch log per run would accumulate without bound.
    expect(existsSync(path)).toBe(false);
    // Safe to call more than once - the orchestrator cleans up in a finally.
    expect(() => batch.discardCapturedOutput()).not.toThrow();
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

  it('drops a chunk that arrives after the flush, without a second file', async () => {
    const child = fakeChildProcess();

    const batch = withEnvironmentVariables(FOLDING_ENV, () => {
      const b = new BatchProcess(child, '@nx/gradle:batch');
      captureForwarded(() => {
        (child as any).stdout.emit('data', Buffer.from('during\n'));
      });
      return b;
    });

    const path = batch.getCapturedOutputPath();
    // Production order: both readers flush before touching the path. stdout can
    // still deliver past the exit event that getResults() settles on, and the
    // flush has ended the stream by then - so the late chunk is lost. What must
    // NOT happen is a second file, or the write killing the run.
    await batch.flushCapturedOutput();
    expect(() =>
      withEnvironmentVariables(FOLDING_ENV, () => {
        captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('after handover\n'));
        });
      })
    ).not.toThrow();

    expect(batch.getCapturedOutputPath()).toEqual(path);
    expect(readFileSync(path, 'utf-8')).toEqual('during\n');
    batch.discardCapturedOutput();
    expect(existsSync(path)).toBe(false);
  });

  it('leaves nothing behind when a chunk arrives after discard', () => {
    const child = fakeChildProcess();

    const batch = withEnvironmentVariables(FOLDING_ENV, () => {
      const b = new BatchProcess(child, '@nx/gradle:batch');
      captureForwarded(() => {
        (child as any).stdout.emit('data', Buffer.from('during\n'));
      });
      return b;
    });

    const path = batch.getCapturedOutputPath();
    batch.discardCapturedOutput();
    // Nothing will ever read it now, so recording would only orphan a file.
    withEnvironmentVariables(FOLDING_ENV, () => {
      captureForwarded(() => {
        (child as any).stdout.emit('data', Buffer.from('after discard\n'));
      });
    });

    expect(existsSync(path)).toBe(false);
    expect(batch.getCapturedOutputPath()).toBeUndefined();
  });

  it('keeps a following collapsed summary on its own line', () => {
    const child = fakeChildProcess();

    // Batch chunks are forwarded raw, unlike forked-task streaming, which
    // addPrefixTransformer re-emits a whole line at a time. A chunk that ends
    // mid-line must not have the next task's ✔ line glued onto it.
    const result = withEnvironmentVariables(
      { GITHUB_ACTIONS: undefined, NX_SKIP_LOG_GROUPING: undefined },
      () => {
        new BatchProcess(child, '@nx/js:tsc');
        return captureForwarded(() => {
          // Establish a known line start; the raw chunk below is what has to
          // move it, and an earlier test must not decide this one's outcome.
          output.addNewline();
          (child as any).stdout.emit('data', Buffer.from('compiling...'));
          output.logCommandSummary('nx run lib:build', 'local-cache');
        });
      }
    );

    const summary = `${figures.tick}  nx run lib:build`;
    const stdout = stripVTControlCharacters(result.stdout);
    const index = stdout.indexOf(summary);
    expect(index).toBeGreaterThan(-1);
    expect(stdout[index - 1]).toEqual('\n');
  });
  it('prints nothing live when the style does not print task output', () => {
    const child = fakeChildProcess();

    // No grouping, so this is the branch that forwards live. `summary` reports
    // each task's log by path, and this class writes to `output` directly from
    // a stream handler - the life cycle cannot stop it, so it has to be told.
    const forwarded = withEnvironmentVariables(
      { GITHUB_ACTIONS: undefined, NX_SKIP_LOG_GROUPING: undefined },
      () => {
        new BatchProcess(child, '@nx/js:tsc', false);
        return captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('worker chatter\n'));
          (child as any).stderr.emit('data', Buffer.from('worker warning\n'));
        });
      }
    );

    expect(forwarded.stdout).not.toContain('worker chatter');
    expect(forwarded.stderr).not.toContain('worker warning');
  });

  it('still prints live when the style does print task output', () => {
    const child = fakeChildProcess();

    const forwarded = withEnvironmentVariables(
      { GITHUB_ACTIONS: undefined, NX_SKIP_LOG_GROUPING: undefined },
      () => {
        new BatchProcess(child, '@nx/js:tsc');
        return captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('worker chatter\n'));
        });
      }
    );

    expect(forwarded.stdout).toContain('worker chatter');
  });
  it('captures rather than drops when the style will not print it', async () => {
    const child = fakeChildProcess();

    // No grouping AND a style that prints nothing. Suppressing the live write
    // without capturing loses the bytes outright - and a batch worker's crash
    // output is exactly what no task ever claims, so nothing else holds a copy.
    const batch = withEnvironmentVariables(
      { GITHUB_ACTIONS: undefined, NX_SKIP_LOG_GROUPING: undefined },
      () => {
        const b = new BatchProcess(child, '@nx/gradle:batch', false);
        captureForwarded(() => {
          (child as any).stdout.emit(
            'data',
            Buffer.from('why the worker died\n')
          );
        });
        return b;
      }
    );

    await batch.flushCapturedOutput();
    const path = batch.getCapturedOutputPath();
    expect(path).toBeDefined();
    expect(readFileSync(path, 'utf-8')).toContain('why the worker died');
    batch.discardCapturedOutput();
  });

  it('survives a capture write error rather than taking the run down', async () => {
    const child = fakeChildProcess();

    try {
      mockFailWriteStream = true;
      const batch = withEnvironmentVariables(FOLDING_ENV, () => {
        const b = new BatchProcess(child, '@nx/gradle:batch');
        captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('head\n'));
        });
        return b;
      });
      const path = batch.getCapturedOutputPath();

      // The failure reaches a stream as an 'error' event, asynchronously.
      // Without a listener on the stream that is an uncaught exception, which
      // would kill a run that had nothing else wrong with it.
      await new Promise((resolve) => setImmediate(resolve));

      // Capture is over, but the batch keeps running and later chunks are not
      // an error either.
      expect(() =>
        withEnvironmentVariables(FOLDING_ENV, () => {
          captureForwarded(() => {
            (child as any).stdout.emit('data', Buffer.from('after\n'));
          });
        })
      ).not.toThrow();

      // What reached the file before the failure is kept, not unlinked: it is
      // the head of the batch's log.
      expect(existsSync(path)).toBe(true);
      batch.discardCapturedOutput();
    } finally {
      mockFailWriteStream = false;
    }
  });
});
