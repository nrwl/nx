import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import { getCompletionShell, isCompletionRequest } from './trigger';

describe('completion/trigger', () => {
  describe('isCompletionRequest', () => {
    it.each([
      // NX_COMPLETE value, expected
      [undefined, false],
      ['', false],
      ['bash', true],
      // A non-empty value still signals completion mode; getCompletionShell
      // is what distinguishes a usable shell name.
      ['nushell', true],
    ])('NX_COMPLETE=%p -> %s', (nxComplete, expected) => {
      withEnvironmentVariables({ NX_COMPLETE: nxComplete }, () => {
        expect(isCompletionRequest()).toBe(expected);
      });
    });
  });

  describe('getCompletionShell', () => {
    it.each(['bash', 'zsh', 'fish', 'powershell'])(
      'returns %s when NX_COMPLETE is that shell',
      (shell) => {
        withEnvironmentVariables({ NX_COMPLETE: shell }, () => {
          expect(getCompletionShell()).toBe(shell);
        });
      }
    );

    it('returns null when NX_COMPLETE is unset', () => {
      withEnvironmentVariables({ NX_COMPLETE: undefined }, () => {
        expect(getCompletionShell()).toBeNull();
      });
    });

    it('returns null for an unrecognized shell', () => {
      withEnvironmentVariables({ NX_COMPLETE: 'nushell' }, () => {
        expect(getCompletionShell()).toBeNull();
      });
    });
  });
});
