import { getCompletionShell, isCompletionRequest } from './trigger';

describe('completion/trigger', () => {
  let originalNxComplete: string | undefined;

  beforeEach(() => {
    originalNxComplete = process.env.NX_COMPLETE;
  });

  afterEach(() => {
    if (originalNxComplete === undefined) {
      delete process.env.NX_COMPLETE;
    } else {
      process.env.NX_COMPLETE = originalNxComplete;
    }
  });

  describe('isCompletionRequest', () => {
    it('is false when NX_COMPLETE is unset', () => {
      delete process.env.NX_COMPLETE;
      expect(isCompletionRequest()).toBe(false);
    });

    it('is false when NX_COMPLETE is empty', () => {
      process.env.NX_COMPLETE = '';
      expect(isCompletionRequest()).toBe(false);
    });

    it('is true when NX_COMPLETE is set to a known shell', () => {
      process.env.NX_COMPLETE = 'bash';
      expect(isCompletionRequest()).toBe(true);
    });

    it('is true even when NX_COMPLETE is an unrecognized value', () => {
      // A non-empty value still signals completion mode; getCompletionShell
      // is what distinguishes a usable shell name.
      process.env.NX_COMPLETE = 'nushell';
      expect(isCompletionRequest()).toBe(true);
    });
  });

  describe('getCompletionShell', () => {
    it.each(['bash', 'zsh', 'fish', 'powershell'])(
      'returns %s when NX_COMPLETE is that shell',
      (shell) => {
        process.env.NX_COMPLETE = shell;
        expect(getCompletionShell()).toBe(shell);
      }
    );

    it('returns null when NX_COMPLETE is unset', () => {
      delete process.env.NX_COMPLETE;
      expect(getCompletionShell()).toBeNull();
    });

    it('returns null for an unrecognized shell', () => {
      process.env.NX_COMPLETE = 'nushell';
      expect(getCompletionShell()).toBeNull();
    });
  });
});
