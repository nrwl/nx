import * as figures from 'figures';
import { EventEmitter } from 'events';
import { stripVTControlCharacters } from 'util';
import { output } from '../../utils/output';

// `running-tasks.ts` imports `spawn` by name, so the binding is resolved at load
// time and a spy on the child_process namespace never sees it - the module has
// to be replaced instead.
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
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
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
});
