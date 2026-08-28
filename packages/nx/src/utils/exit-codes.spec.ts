import type { MockInstance } from 'vitest';
import { exitAsInterrupted, messageToCode } from './exit-codes';

describe('messageToCode', () => {
  it('should return 0 for Success', () => {
    expect(messageToCode('Success')).toBe(0);
  });

  it('should parse "Exited with code" messages', () => {
    expect(messageToCode('Exited with code 0')).toBe(0);
    expect(messageToCode('Exited with code 1')).toBe(1);
    expect(messageToCode('Exited with code 127')).toBe(127);
  });

  it('should return 1 for unknown messages', () => {
    expect(messageToCode('Something unexpected')).toBe(1);
  });

  describe('Terminated by signal (Linux exact match)', () => {
    it('should handle Hangup', () => {
      expect(messageToCode('Terminated by Hangup')).toBe(129);
    });
    it('should handle Interrupt', () => {
      expect(messageToCode('Terminated by Interrupt')).toBe(130);
    });
    it('should handle Quit', () => {
      expect(messageToCode('Terminated by Quit')).toBe(131);
    });
    it('should handle Abort', () => {
      expect(messageToCode('Terminated by Abort')).toBe(134);
    });
    it('should handle Killed', () => {
      expect(messageToCode('Terminated by Killed')).toBe(137);
    });
    it('should handle Terminated', () => {
      expect(messageToCode('Terminated by Terminated')).toBe(143);
    });
    it('should return 128 for unknown signal', () => {
      expect(messageToCode('Terminated by Unknown')).toBe(128);
    });
  });

  describe('Terminated by signal (macOS strsignal format)', () => {
    it('should handle "Hangup: 1"', () => {
      expect(messageToCode('Terminated by Hangup: 1')).toBe(129);
    });
    it('should handle "Interrupt: 2"', () => {
      expect(messageToCode('Terminated by Interrupt: 2')).toBe(130);
    });
    it('should handle "Quit: 3"', () => {
      expect(messageToCode('Terminated by Quit: 3')).toBe(131);
    });
    it('should handle "Abort trap: 6"', () => {
      expect(messageToCode('Terminated by Abort trap: 6')).toBe(134);
    });
    it('should handle "Killed: 9"', () => {
      expect(messageToCode('Terminated by Killed: 9')).toBe(137);
    });
    it('should handle "Terminated: 15"', () => {
      expect(messageToCode('Terminated by Terminated: 15')).toBe(143);
    });
  });
});

describe('exitAsInterrupted', () => {
  // Every one of these is stubbed deliberately: unstubbed, `kill` would signal
  // this test worker and `removeAllListeners` would strip its SIGINT handling.
  let spies: MockInstance[];
  let platform: PropertyDescriptor | undefined;

  function stubProcess(as: NodeJS.Platform) {
    platform = Object.getOwnPropertyDescriptor(process, 'platform');
    // `process.platform` is a data property, so it cannot be spied on.
    Object.defineProperty(process, 'platform', {
      value: as,
      configurable: true,
    });
    const removeAllListeners = vi
      .spyOn(process, 'removeAllListeners')
      .mockReturnValue(process);
    const kill = vi
      .spyOn(process, 'kill')
      .mockImplementation((() => true) as never);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exited');
    }) as never);
    spies = [removeAllListeners, kill, exit];
    return { removeAllListeners, kill, exit };
  }

  afterEach(() => {
    spies?.forEach((s) => s.mockRestore());
    if (platform) {
      Object.defineProperty(process, 'platform', platform);
    }
  });

  it('should terminate by SIGINT so a parent sees an interrupt, not a failure', () => {
    const { removeAllListeners, kill } = stubProcess('darwin');

    expect(() => exitAsInterrupted()).toThrow('exited');
    // Listeners go first: one left in place would swallow the signal.
    expect(removeAllListeners).toHaveBeenCalledWith('SIGINT');
    expect(kill).toHaveBeenCalledWith(process.pid, 'SIGINT');
  });

  it('should fall back to the conventional code on Windows, which has no signals', () => {
    const { kill, exit } = stubProcess('win32');

    expect(() => exitAsInterrupted()).toThrow('exited');
    expect(kill).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(130);
  });
});
