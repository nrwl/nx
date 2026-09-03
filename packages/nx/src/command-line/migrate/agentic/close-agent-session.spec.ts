vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
import { EventEmitter } from 'events';
import type { Mock } from 'vitest';
import { closeAgentSession, waitForExit } from './close-agent-session';

const mockExecSync = execSync as unknown as Mock;

type FakeChild = EventEmitter & {
  pid?: number;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  kill: Mock<boolean, [NodeJS.Signals?]>;
};

function fakeChild(exitOnSignal: NodeJS.Signals[] = ['SIGINT']): FakeChild {
  const ee = new EventEmitter() as FakeChild;
  ee.exitCode = null;
  ee.signalCode = null;
  ee.kill = vi.fn((signal?: NodeJS.Signals) => {
    if (exitOnSignal.includes(signal)) {
      setImmediate(() => {
        ee.signalCode = signal;
        ee.emit('exit', null, signal);
      });
    }
    return true;
  });
  return ee;
}

describe('waitForExit', () => {
  it('merges an exit and a trailing error into one settlement', async () => {
    const child = fakeChild();
    const exited = waitForExit(child as any);
    child.emit('exit', 1, null);
    child.emit('error', new Error('boom'));

    await expect(exited).resolves.toEqual({
      code: 1,
      signal: null,
      error: new Error('boom'),
    });
  });

  it('settles on an error that never gets an exit', async () => {
    const child = fakeChild();
    const exited = waitForExit(child as any);
    child.emit('error', new Error('spawn ENOENT'));

    await expect(exited).resolves.toEqual({ error: new Error('spawn ENOENT') });
  });
});

describe('closeAgentSession', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    mockExecSync.mockReset();
  });

  it('returns without signalling a child that already exited', async () => {
    const child = fakeChild();
    child.exitCode = 0;

    await closeAgentSession(child as any, Promise.resolve({}), 10, 10);

    expect(child.kill).not.toHaveBeenCalled();
  });

  it('stops at SIGINT when the child exits within the grace period', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const child = fakeChild(['SIGINT']);

    await closeAgentSession(child as any, waitForExit(child as any), 50, 50);

    expect(child.kill.mock.calls).toEqual([['SIGINT']]);
  });

  it('escalates to SIGKILL once the grace period elapses', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const child = fakeChild(['SIGKILL']);

    await closeAgentSession(child as any, waitForExit(child as any), 20, 50);

    expect(child.kill.mock.calls).toEqual([['SIGINT'], ['SIGKILL']]);
    expect(child.signalCode).toBe('SIGKILL');
  });

  it('kills the process tree with taskkill on Windows and returns when it fails', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const child = fakeChild([]);
    child.pid = 4242;
    mockExecSync.mockImplementation(() => {
      throw new Error('taskkill: not found');
    });

    await closeAgentSession(child as any, waitForExit(child as any), 20, 20);

    expect(child.kill).not.toHaveBeenCalled();
    expect(mockExecSync).toHaveBeenCalledWith(
      'taskkill /T /F /PID 4242',
      expect.objectContaining({ windowsHide: true })
    );
  });
});
