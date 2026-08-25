import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let mockCacheRoot = '';

jest.mock('../../tasks-runner/terminal-output-path', () => ({
  terminalOutputPathForHash: (hash: string) =>
    require('node:path').join(mockCacheRoot, hash),
}));

jest.mock('../../utils/logger', () => ({
  logger: { warn: jest.fn() },
}));

import { serialize } from '../../daemon/socket-utils';
import { logger } from '../../utils/logger';
import type { PostTasksExecutionContext } from './public-api';
import {
  rehydrateTerminalOutputs,
  stubTerminalOutputs,
} from './task-results-stub';

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
    (logger.warn as jest.Mock).mockClear();
  });

  afterEach(() => {
    rmSync(mockCacheRoot, { recursive: true, force: true });
  });

  function writeOutput(hash: string, contents: string) {
    writeFileSync(join(mockCacheRoot, hash), contents);
  }

  it('replaces the output with its path when the file exists', () => {
    writeOutput('abc', 'the real output');
    const stubbed = stubTerminalOutputs(
      contextWith({ 'proj:build': result('abc', 'the real output') })
    );

    expect(stubbed.taskResults['proj:build'].terminalOutput).toBe(
      join(mockCacheRoot, 'abc')
    );
    expect(stubbed.stubbedTerminalOutputs).toEqual(['proj:build']);
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

    const wire = serialize(
      stubTerminalOutputs(contextWith({ 'proj:build': result('abc', output) }))
    );

    expect(wire).not.toContain(output);
    expect(wire).toContain('abc');
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
    const once = stubTerminalOutputs(
      contextWith({ 'proj:build': result('abc', 'the real output') })
    );
    const twice = stubTerminalOutputs(once);

    expect(twice).toBe(once);
    expect(twice.taskResults['proj:build'].terminalOutput).toBe(
      join(mockCacheRoot, 'abc')
    );
    expect(twice.stubbedTerminalOutputs).toEqual(['proj:build']);
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
    const stubbed = stubTerminalOutputs(
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
    const stubbed = stubTerminalOutputs(
      contextWith({
        'proj:build': result('has-file', 'read me from disk'),
        'proj:test': result('no-file', 'inline please'),
      })
    );

    expect(stubbed.stubbedTerminalOutputs).toEqual(['proj:build']);
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
});
