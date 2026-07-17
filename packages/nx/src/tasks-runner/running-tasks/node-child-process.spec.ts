import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { ChildProcess } from 'child_process';
import { NodeChildProcessWithNonDirectOutput } from './node-child-process';

function makeMockChildProcess(): ChildProcess {
  const proc = new EventEmitter() as EventEmitter & Partial<ChildProcess>;
  proc.stdout = new PassThrough() as any;
  proc.stderr = new PassThrough() as any;
  return proc as ChildProcess;
}

describe('NodeChildProcessWithNonDirectOutput', () => {
  it('captures late stdout that arrives after the child exits (#35302)', async () => {
    const proc = makeMockChildProcess();
    const wrapped = new NodeChildProcessWithNonDirectOutput(proc, {
      streamOutput: false,
      prefix: 'test',
    });

    const exitSpy = jest.fn();
    wrapped.onExit(exitSpy);

    // Simulate the race reported in #35302: 'exit' fires synchronously,
    // then stdout 'data' arrives on a subsequent tick, then 'close' fires
    // after stdio has drained. Before the fix the exit handler listened
    // for 'exit', joined chunks early, and dropped the late output.
    proc.emit('exit', 0, null);
    proc.stdout!.emit('data', Buffer.from('late-output'));
    proc.emit('close', 0, null);

    // Allow any microtasks to settle.
    await Promise.resolve();

    const { terminalOutput } = await wrapped.getResults();
    expect(terminalOutput).toContain('late-output');
    expect(exitSpy).toHaveBeenCalledTimes(1);
  });

  it('captures output that arrives before the child closes', async () => {
    const proc = makeMockChildProcess();
    const wrapped = new NodeChildProcessWithNonDirectOutput(proc, {
      streamOutput: false,
      prefix: 'test',
    });

    proc.stdout!.emit('data', Buffer.from('hello'));
    proc.stderr!.emit('data', Buffer.from('world'));
    proc.emit('close', 0, null);

    const { code, terminalOutput } = await wrapped.getResults();
    expect(code).toBe(0);
    expect(terminalOutput).toContain('hello');
    expect(terminalOutput).toContain('world');
  });
});
