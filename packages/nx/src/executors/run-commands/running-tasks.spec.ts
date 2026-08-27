import * as figures from 'figures';
import { EventEmitter } from 'events';
import { stripVTControlCharacters } from 'util';
import { output } from '../../utils/output';

// Replaces the module rather than spying. A spy reaches this code only through
// `require('child_process')`; an `import * as cp` is an interop wrapper under
// this repo's transform, not the module object, so a spy on it is not observed
// here (measured: 0 calls). Mocking the module works either way.
const mockChild = () => {
  const cp: any = new EventEmitter();
  cp.stdout = new EventEmitter();
  cp.stderr = new EventEmitter();
  cp.stdout.setEncoding = () => {};
  cp.stderr.setEncoding = () => {};
  cp.pid = 4242;
  cp.kill = () => {};
  return cp;
};
let mockSpawned: any;
vi.mock('child_process', async () => ({
  ...require('child_process'),
  spawn: () => mockSpawned,
}));

import { ParallelRunningTasks } from './running-tasks';

function captureStdout(cb: () => void): string {
  const original = process.stdout.write;
  let out = '';
  process.stdout.write = ((chunk: any) => {
    out += chunk;
    return true;
  }) as any;
  try {
    cb();
  } finally {
    process.stdout.write = original;
  }
  return stripVTControlCharacters(out);
}

describe('run-commands output routing', () => {
  // Guards the routing itself rather than the tracker. A spec that calls
  // `output.writeTaskOutputChunk` directly passes even if every call site in
  // this file is reverted to a raw `process.stdout.write`, which is exactly the
  // regression that shipped once.
  it('keeps a following summary off the end of a streamed mid-line chunk', () => {
    mockSpawned = mockChild();
    const result = captureStdout(() => {
      new ParallelRunningTasks(
        {
          commands: [{ command: 'webpack --watch' }],
          color: false,
          cwd: '.',
          env: {},
          readyWhenStatus: [],
          streamOutput: true,
          envFile: undefined,
          parallel: true,
        } as any,
        { root: '.' } as any,
        'lib:dev'
      );
      // Establish a known line start; the chunk below is what has to move it.
      output.addNewline();
      // `addColorAndPrefix` splits on newlines without appending one, so a
      // partial line from a watcher ends mid-line.
      mockSpawned.stdout.emit('data', '[webpack] compiling...');
      // A sibling task finishing is what gets glued on.
      output.logCommandSummary('nx run lib:build', 'local-cache');
    });

    const summary = `${figures.tick}  nx run lib:build`;
    const index = result.indexOf(summary);
    expect(index).toBeGreaterThan(-1);
    expect(result[index - 1]).toEqual('\n');
  });
  // The gluing test above proves the tracker end to end, but only for the
  // stdout handler - the other three writes in this class could each be
  // reverted to a raw `process.std*.write` with it still green. This pins every
  // one of them, and the stream each goes to.
  it('routes every write in the class through the line tracker', () => {
    mockSpawned = mockChild();
    const routed = vi
      .spyOn(output, 'writeTaskOutputChunk')
      .mockImplementation(() => {});

    try {
      new ParallelRunningTasks(
        {
          commands: [{ command: 'webpack --watch' }],
          color: false,
          cwd: '.',
          env: {},
          readyWhenStatus: [],
          streamOutput: true,
          envFile: undefined,
          parallel: true,
        } as any,
        { root: '.' } as any,
        'lib:dev'
      );
      // 1. the command header, written at construction, on stdout
      const headerCall = routed.mock.calls.find((c) =>
        String(c[0]).includes('webpack --watch')
      );
      expect(headerCall).toBeDefined();
      expect(headerCall[1]).toBe(process.stdout);

      routed.mockClear();
      mockSpawned.stdout.emit('data', 'to stdout');
      expect(routed).toHaveBeenCalledTimes(1);
      // 2. stdout output goes to stdout
      expect(String(routed.mock.calls[0][0])).toContain('to stdout');
      expect(routed.mock.calls[0][1]).toBe(process.stdout);

      routed.mockClear();
      mockSpawned.stderr.emit('data', 'to stderr');
      expect(routed).toHaveBeenCalledTimes(1);
      // 3. stderr keeps its stream rather than being folded into stdout
      expect(String(routed.mock.calls[0][0])).toContain('to stderr');
      expect(routed.mock.calls[0][1]).toBe(process.stderr);

      routed.mockClear();
      mockSpawned.emit('error', new Error('spawn ENOENT'));
      expect(routed).toHaveBeenCalledTimes(1);
      // 4. the spawn-failure path, which reports on stderr
      expect(String(routed.mock.calls[0][0])).toContain('spawn ENOENT');
      expect(routed.mock.calls[0][1]).toBe(process.stderr);
    } finally {
      routed.mockRestore();
    }
  });
});
