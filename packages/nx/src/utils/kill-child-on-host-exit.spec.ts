import type { Mock } from 'vitest';
vi.mock('../native', () => ({ killProcessTree: vi.fn() }));

import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { killProcessTree } from '../native';
import {
  killChildOnHostExit,
  killTrackedChildren,
} from './kill-child-on-host-exit';

function fakeChild(pid: number | undefined): ChildProcess {
  const cp = new EventEmitter() as ChildProcess;
  (cp as any).pid = pid;
  return cp;
}

describe('killChildOnHostExit', () => {
  beforeEach(() => {
    (killProcessTree as Mock).mockReset();
    killTrackedChildren();
  });

  it('should kill tracked children that are still running', () => {
    killChildOnHostExit(fakeChild(123));

    killTrackedChildren();

    expect(killProcessTree).toHaveBeenCalledWith(123, 'SIGTERM');
  });

  it('should stop tracking a child once it exits', () => {
    const cp = fakeChild(123);
    killChildOnHostExit(cp);
    cp.emit('exit', 0, null);

    killTrackedChildren();

    expect(killProcessTree).not.toHaveBeenCalled();
  });

  it('should stop tracking a child that failed to spawn', () => {
    const cp = fakeChild(123);
    killChildOnHostExit(cp);
    cp.emit('error', new Error('ENOENT'));

    killTrackedChildren();

    expect(killProcessTree).not.toHaveBeenCalled();
  });

  it('should ignore a child without a pid', () => {
    killChildOnHostExit(fakeChild(undefined));

    killTrackedChildren();

    expect(killProcessTree).not.toHaveBeenCalled();
  });

  it('should clear the set after killing', () => {
    killChildOnHostExit(fakeChild(123));

    killTrackedChildren();
    killTrackedChildren();

    expect(killProcessTree).toHaveBeenCalledTimes(1);
  });
});
