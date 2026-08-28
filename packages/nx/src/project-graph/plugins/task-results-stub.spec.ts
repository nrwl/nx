import type { Mock } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let mockCacheRoot = '';

vi.mock('../../tasks-runner/terminal-output-path', async () => ({
  terminalOutputPathForHash: (hash: string) =>
    require('node:path').join(mockCacheRoot, hash),
}));

vi.mock('../../utils/logger', async () => ({
  logger: { warn: vi.fn() },
}));

import { serialize } from '../../daemon/socket-utils';
import { logger } from '../../utils/logger';
import type { PostTasksExecutionContext } from './public-api';
import {
  rehydrateTerminalOutputs,
  stubTerminalOutputs,
  type StubbedPostTasksExecutionContext,
} from './task-results-stub';

// `stubTerminalOutputs` returns the union, so the tests that read the map say
// once that they expect the stubbed arm rather than casting at each assertion.
function stub(context: PostTasksExecutionContext) {
  return stubTerminalOutputs(context) as StubbedPostTasksExecutionContext;
}

function result(hash: string | undefined, terminalOutput: string | undefined) {
  return {
    task: { id: `proj:${hash}`, hash, target: { project: 'proj' } },
    status: 'success',
    code: 0,
    terminalOutput,
  } as any;
}

function contextWith(
  taskResults: Record<string, any>
): PostTasksExecutionContext {
  return {
    id: 'run-1',
    workspaceRoot: '/ws',
    nxJsonConfiguration: {},
    taskResults,
    argv: [],
    startTime: 0,
    endTime: 1,
  } as any;
}

describe('task results terminal output stubbing', () => {
  beforeEach(() => {
    mockCacheRoot = mkdtempSync(join(tmpdir(), 'nx-stub-'));
    (logger.warn as Mock).mockClear();
  });

  afterEach(() => {
    rmSync(mockCacheRoot, { recursive: true, force: true });
  });

  function writeOutput(hash: string, contents: string) {
    writeFileSync(join(mockCacheRoot, hash), contents);
  }

  it('replaces the output with its path when the file exists', () => {
    writeOutput('abc', 'the real output');
    const stubbed = stub(
      contextWith({ 'proj:build': result('abc', 'the real output') })
    );

    expect(stubbed.taskResults['proj:build']).not.toHaveProperty(
      'terminalOutput'
    );
    expect(stubbed.stubbedTerminalOutputs).toEqual({
      'proj:build': join(mockCacheRoot, 'abc'),
    });
  });

  it('round trips the exact bytes back', () => {
    const output = 'line one\nline two[31m red [0m';
    writeOutput('abc', output);

    const rehydrated = rehydrateTerminalOutputs(
      stubTerminalOutputs(contextWith({ 'proj:build': result('abc', output) }))
    );

    expect(rehydrated.taskResults['proj:build'].terminalOutput).toBe(output);
    expect(rehydrated).not.toHaveProperty('stubbedTerminalOutputs');
  });

  // The bug this exists to fix: both JSON.stringify and the v8 fallback have to
  // materialize the payload as one string, so the bytes must not be in it.
  it('keeps the output out of the serialized payload', () => {
    const output = 'a-very-distinctive-output-marker';
    writeOutput('abc', output);

    // `serialize` returns bytes, not a string. Decoded as latin1 so a byte
    // buffer is searchable for ASCII either way: an `expect(buffer)
    // .not.toContain(string)` looks for a matching ELEMENT and so passes on
    // any buffer, which would make the first assertion here unfalsifiable.
    const wire = serialize(
      stubTerminalOutputs(contextWith({ 'proj:build': result('abc', output) }))
    ).toString('latin1');

    expect(wire).not.toContain(output);
    expect(wire).toContain(join(mockCacheRoot, 'abc'));
  });

  // Returned as-is rather than rebuilt, so a run with nothing on disk puts
  // exactly the payload on the wire that it did before any of this existed.
  describe('hands back the context untouched when there is no file to point at', () => {
    it('when the task was never hashed', () => {
      const context = contextWith({
        'proj:build': result(undefined, 'crashed early'),
      });

      expect(stubTerminalOutputs(context)).toBe(context);
    });

    it('when the file was never written', () => {
      const context = contextWith({
        'proj:build': result('nofile', 'still here'),
      });

      expect(stubTerminalOutputs(context)).toBe(context);
    });

    it('when the task produced no output', () => {
      writeOutput('abc', 'orphan file');
      const context = contextWith({ 'proj:build': result('abc', undefined) });

      expect(stubTerminalOutputs(context)).toBe(context);
    });
  });

  // The daemon stubs, then hands the same context to an isolated plugin, which
  // stubs again before its own send.
  it('is idempotent, so a second transport can re-stub', () => {
    writeOutput('abc', 'the real output');
    const once = stub(
      contextWith({ 'proj:build': result('abc', 'the real output') })
    );
    const twice = stubTerminalOutputs(once) as StubbedPostTasksExecutionContext;

    expect(twice).toBe(once);
    expect(twice.stubbedTerminalOutputs).toEqual({
      'proj:build': join(mockCacheRoot, 'abc'),
    });
    expect(
      rehydrateTerminalOutputs(twice).taskResults['proj:build'].terminalOutput
    ).toBe('the real output');
  });

  it('returns an unstubbed context untouched', () => {
    const context = contextWith({
      'proj:build': result('abc', 'never left the process'),
    });

    expect(rehydrateTerminalOutputs(context)).toBe(context);
  });

  it('reports a missing file as no output rather than handing back the path', () => {
    writeOutput('abc', 'about to vanish');
    const stubbed = stub(
      contextWith({ 'proj:build': result('abc', 'about to vanish') })
    );
    rmSync(join(mockCacheRoot, 'abc'));

    const rehydrated = rehydrateTerminalOutputs(stubbed);

    expect(rehydrated.taskResults['proj:build'].terminalOutput).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(join(mockCacheRoot, 'abc'))
    );
  });

  it('stubs only the results that have a file, leaving the rest inline', () => {
    writeOutput('has-file', 'read me from disk');
    const stubbed = stub(
      contextWith({
        'proj:build': result('has-file', 'read me from disk'),
        'proj:test': result('no-file', 'inline please'),
      })
    );

    expect(stubbed.stubbedTerminalOutputs).toEqual({
      'proj:build': join(mockCacheRoot, 'has-file'),
    });
    expect(stubbed.taskResults['proj:test'].terminalOutput).toBe(
      'inline please'
    );

    const rehydrated = rehydrateTerminalOutputs(stubbed);
    expect(rehydrated.taskResults['proj:build'].terminalOutput).toBe(
      'read me from disk'
    );
    expect(rehydrated.taskResults['proj:test'].terminalOutput).toBe(
      'inline please'
    );
  });

  // The point of holding paths out of band: a transport that stubs and forgets
  // to rehydrate hands over a missing value, never a filename that a plugin
  // would read as the output itself.
  it('leaves no path behind in terminalOutput for an unrehydrated reader', () => {
    writeOutput('abc', 'the real output');
    const stubbed = stub(
      contextWith({ 'proj:build': result('abc', 'the real output') })
    );

    expect(stubbed.taskResults['proj:build'].terminalOutput).toBeUndefined();
    expect(JSON.stringify(stubbed.taskResults)).not.toContain(mockCacheRoot);
  });

  // The daemon stubs for its own send, and the same context is then handed to
  // an isolated plugin. A result that became stubbable in between joins the map
  // rather than staying inline.
  it('stubs a newly stubbable result on a context that is already stubbed', () => {
    writeOutput('has-file', 'read me from disk');
    const once = stub(
      contextWith({
        'proj:build': result('has-file', 'read me from disk'),
        'proj:test': result('late-file', 'inline for now'),
      })
    );

    writeOutput('late-file', 'now on disk');
    const twice = stubTerminalOutputs(once) as StubbedPostTasksExecutionContext;

    expect(twice.stubbedTerminalOutputs).toEqual({
      'proj:build': join(mockCacheRoot, 'has-file'),
      'proj:test': join(mockCacheRoot, 'late-file'),
    });
    const rehydrated = rehydrateTerminalOutputs(twice);
    expect(rehydrated.taskResults['proj:build'].terminalOutput).toBe(
      'read me from disk'
    );
    expect(rehydrated.taskResults['proj:test'].terminalOutput).toBe(
      'now on disk'
    );
  });

  // The caller keeps using its own context after handing one to a transport,
  // so the swap has to build a new object rather than edit theirs.
  it('does not mutate the context it was given', () => {
    writeOutput('abc', 'the real output');
    const context = contextWith({
      'proj:build': result('abc', 'the real output'),
    });

    stubTerminalOutputs(context);

    expect(context.taskResults['proj:build'].terminalOutput).toBe(
      'the real output'
    );
    expect(context).not.toHaveProperty('stubbedTerminalOutputs');
  });

  // An empty log is a real result, and `''` is falsy, so it is the value most
  // likely to be dropped by a truthiness check on the way through.
  it('round trips an empty output rather than losing it', () => {
    writeOutput('abc', '');
    const rehydrated = rehydrateTerminalOutputs(
      stub(contextWith({ 'proj:build': result('abc', '') }))
    );

    expect(rehydrated.taskResults['proj:build'].terminalOutput).toBe('');
  });

  // A hash is whatever the hasher returned, and this one reaches a read. The
  // file has to exist for the assertion to mean anything: a traversal that
  // lands on nothing is refused by the existence check either way.
  it('does not read outside the cache dir when the hash is a path', () => {
    const outside = join(mockCacheRoot, '..', 'nx-stub-outside-the-cache');
    writeFileSync(outside, 'should never be read');
    try {
      const context = contextWith({
        'proj:build': result(
          join('..', 'nx-stub-outside-the-cache'),
          'inline please'
        ),
      });

      const stubbed = stubTerminalOutputs(context);

      expect(stubbed).toBe(context);
      expect(stubbed.taskResults['proj:build'].terminalOutput).toBe(
        'inline please'
      );
    } finally {
      rmSync(outside, { force: true });
    }
  });
});
