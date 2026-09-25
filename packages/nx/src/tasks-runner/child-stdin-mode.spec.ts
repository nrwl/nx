import { childStdinMode } from './child-stdin-mode';

describe('childStdinMode', () => {
  const originalPlatform = process.platform;

  function withPlatform(plat: NodeJS.Platform, fn: () => void) {
    Object.defineProperty(process, 'platform', {
      value: plat,
      configurable: true,
    });
    try {
      fn();
    } finally {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    }
  }

  it('inherits stdin on Linux regardless of TUI state', () => {
    withPlatform('linux', () => {
      expect(childStdinMode({ tuiEnabled: false })).toBe('inherit');
      expect(childStdinMode({ tuiEnabled: true })).toBe('inherit');
    });
  });

  it('inherits stdin on macOS regardless of TUI state', () => {
    withPlatform('darwin', () => {
      expect(childStdinMode({ tuiEnabled: false })).toBe('inherit');
      expect(childStdinMode({ tuiEnabled: true })).toBe('inherit');
    });
  });

  it('inherits stdin on Windows when TUI is off', () => {
    withPlatform('win32', () => {
      expect(childStdinMode({ tuiEnabled: false })).toBe('inherit');
    });
  });

  it('ignores stdin on Windows when TUI is on (prevents child/TUI stdin race)', () => {
    withPlatform('win32', () => {
      expect(childStdinMode({ tuiEnabled: true })).toBe('ignore');
    });
  });
});
