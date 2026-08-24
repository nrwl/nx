import * as figures from 'figures';
import { EventEmitter } from 'events';
import { existsSync, readFileSync } from 'fs';

// Replaces the module rather than spying, and gates the failure on a flag so
// every other test here keeps the real fs.
//
// A spy would also work, but only through `require('fs')` - NOT through an
// `import * as fs`, which under this repo's transform is an interop wrapper
// around the module rather than the module object itself, so mutating it
// changes nothing `capture()` can see. Measured: namespace spy 0 calls,
// `require` spy 1, for the same code path. The module mock sidesteps the
// distinction entirely.
let mockFailOpenSync = false;
let mockFailWriteSync = false;
// Writes a prefix, then fails on the next call - a disk filling mid-chunk.
let mockPartialWriteBytes: number | null = null;
vi.mock('fs', async () => {
  const actual = require('fs');
  const enospc = () =>
    Object.assign(new Error('ENOSPC: no space left on device'), {
      code: 'ENOSPC',
    });
  return {
    ...actual,
    openSync: (...args: unknown[]) => {
      if (mockFailOpenSync) {
        throw enospc();
      }
      return (actual.openSync as any)(...args);
    },
    // The likelier real failure: the file opens fine and the disk fills later.
    writeSync: (...args: unknown[]) => {
      if (mockFailWriteSync) {
        throw enospc();
      }
      if (mockPartialWriteBytes !== null) {
        const n = mockPartialWriteBytes;
        mockPartialWriteBytes = null;
        mockFailWriteSync = true;
        const [fd, buffer, offset] = args as [number, Buffer, number];
        return (actual.writeSync as any)(fd, buffer, offset, n);
      }
      return (actual.writeSync as any)(...args);
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
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  (child as any).stdout = new EventEmitter();
  (child as any).stderr = new EventEmitter();
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

  it('captures both streams while folding, so the fold can surface them', () => {
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

  it('captures a batch log without capping it, keeping the head', () => {
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

    const captured = readFileSync(batch.getCapturedOutputPath(), 'utf-8');
    expect(captured.length).toEqual(3_000_000 + 'FINAL_FATAL'.length);
    // Both the head, where a compiler's first errors land, and the tail, where
    // a runner's fatal lands, survive.
    expect(captured.startsWith('x')).toBe(true);
    expect(captured).toContain('FINAL_FATAL');
    batch.discardCapturedOutput();
  });

  it('holds the captured log on disk rather than in memory', () => {
    const child = fakeChildProcess();

    const batch = withEnvironmentVariables(FOLDING_ENV, () => {
      const b = new BatchProcess(child, '@nx/gradle:batch');
      captureForwarded(() => {
        (child as any).stdout.emit('data', Buffer.from('build log line\n'));
      });
      return b;
    });

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

  it('replays a chunk that arrives after the path is handed over', () => {
    const child = fakeChildProcess();

    const batch = withEnvironmentVariables(FOLDING_ENV, () => {
      const b = new BatchProcess(child, '@nx/gradle:batch');
      captureForwarded(() => {
        (child as any).stdout.emit('data', Buffer.from('during\n'));
      });
      return b;
    });

    const path = batch.getCapturedOutputPath();
    // stdout can deliver past the exit event that getResults() settles on, and
    // that trailing output is what the fold exists to carry - so it belongs in
    // the same file, not dropped and not in a second one.
    withEnvironmentVariables(FOLDING_ENV, () => {
      captureForwarded(() => {
        (child as any).stdout.emit('data', Buffer.from('after handover\n'));
      });
    });

    expect(batch.getCapturedOutputPath()).toEqual(path);
    expect(readFileSync(path, 'utf-8')).toEqual('during\nafter handover\n');
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
  it('keeps the run alive and streams live when the capture cannot be written', () => {
    const child = fakeChildProcess();
    const warn = vi.spyOn(output, 'warn').mockImplementation(() => {});
    // A stream 'data' handler is not inside any try the orchestrator owns, so a
    // throw here is an uncaught exception that takes down the whole run,
    // including every task that already passed. ENOSPC and a read-only data
    // directory both reach this line.
    mockFailOpenSync = true;

    try {
      const result = withEnvironmentVariables(FOLDING_ENV, () => {
        const b = new BatchProcess(child, '@nx/gradle:batch');
        const forwarded = captureForwarded(() => {
          expect(() =>
            (child as any).stdout.emit('data', Buffer.from('gradle output\n'))
          ).not.toThrow();
        });
        return { b, forwarded };
      });

      // Degraded, not dead: the bytes go to the terminal instead of the file,
      // so the capture is what is lost rather than the output or the run.
      expect(result.forwarded.stdout).toContain('gradle output');
      expect(result.b.getCapturedOutputPath()).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('@nx/gradle:batch'),
        })
      );
    } finally {
      mockFailOpenSync = false;
      warn.mockRestore();
    }
  });
  it('keeps streaming every later chunk after a capture failure, not just the first', () => {
    const child = fakeChildProcess();
    const warn = vi.spyOn(output, 'warn').mockImplementation(() => {});
    mockFailOpenSync = true;

    try {
      const forwarded = withEnvironmentVariables(FOLDING_ENV, () => {
        new BatchProcess(child, '@nx/gradle:batch');
        return captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('first\n'));
          (child as any).stdout.emit('data', Buffer.from('second\n'));
          (child as any).stderr.emit('data', Buffer.from('on stderr\n'));
        });
      });

      // Latching the discard flag would make every chunk after the first return
      // early - captured nowhere and printed nowhere.
      expect(forwarded.stdout).toContain('first');
      expect(forwarded.stdout).toContain('second');
      // And a stderr chunk has to stay on stderr rather than being folded into
      // stdout by a fallback that forgot which stream it came from.
      expect(forwarded.stderr).toContain('on stderr');
      expect(forwarded.stdout).not.toContain('on stderr');
    } finally {
      mockFailOpenSync = false;
      warn.mockRestore();
    }
  });

  it('keeps what it already captured when the disk fills mid-batch', () => {
    const child = fakeChildProcess();
    const warn = vi.spyOn(output, 'warn').mockImplementation(() => {});

    try {
      const { batch, forwarded } = withEnvironmentVariables(FOLDING_ENV, () => {
        const b = new BatchProcess(child, '@nx/gradle:batch');
        const f = captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('head of the log\n'));
          // Opens fine, fills later - so there are already good bytes on disk.
          mockFailWriteSync = true;
          (child as any).stdout.emit('data', Buffer.from('tail of the log\n'));
        });
        return { batch: b, forwarded: f };
      });

      // The head is where a compiler's first non-cascading errors are, so
      // unlinking the file on failure would discard the most useful part.
      const path = batch.getCapturedOutputPath();
      expect(path).toBeDefined();
      expect(readFileSync(path, 'utf-8')).toContain('head of the log');
      expect(forwarded.stdout).toContain('tail of the log');
      batch.discardCapturedOutput();
    } finally {
      mockFailWriteSync = false;
      warn.mockRestore();
    }
  });
  it('does not replay bytes that already reached the file when a write fails partway', () => {
    const child = fakeChildProcess();
    const warn = vi.spyOn(output, 'warn').mockImplementation(() => {});
    // The first write lands 5 of the chunk's bytes and the next one fails, so
    // the file holds a prefix that the fold will replay later.
    mockPartialWriteBytes = 5;

    try {
      const { batch, forwarded } = withEnvironmentVariables(FOLDING_ENV, () => {
        const b = new BatchProcess(child, '@nx/gradle:batch');
        const f = captureForwarded(() => {
          (child as any).stdout.emit('data', Buffer.from('HEAD:TAIL\n'));
        });
        return { batch: b, forwarded: f };
      });

      // Forwarding the whole chunk would print HEAD: twice - once live now,
      // once from the fold - so only the unwritten remainder goes out.
      expect(readFileSync(batch.getCapturedOutputPath(), 'utf-8')).toEqual(
        'HEAD:'
      );
      expect(forwarded.stdout).toContain('TAIL');
      expect(forwarded.stdout).not.toContain('HEAD:');
      batch.discardCapturedOutput();
    } finally {
      mockPartialWriteBytes = null;
      mockFailWriteSync = false;
      warn.mockRestore();
    }
  });

  it('prints nothing live when the style does not print task output', () => {
    const child = fakeChildProcess();

    // No grouping, so this is the branch that forwards live. `summary` reports
    // each task's log by path, and this class writes to `output` directly from
    // a stream handler - the life cycle cannot stop it, so it has to be told.
    const forwarded = withEnvironmentVariables(
      { GITHUB_ACTIONS: undefined, NX_SKIP_LOG_GROUPING: undefined },
      () => {
        const b = new BatchProcess(child, '@nx/js:tsc', false);
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
});
