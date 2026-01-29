import { messageToCode } from './exit-codes';

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
