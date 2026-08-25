import type { Mock } from 'vitest';
vi.mock('@clack/prompts', () => ({
  autocomplete: vi.fn(),
  isCancel: vi.fn(() => false),
}));

import { autocomplete, isCancel } from '@clack/prompts';
import { migrateChoice, migrateConfirm } from './safe-prompt';

const mockAutocomplete = autocomplete as unknown as Mock;
const mockIsCancel = isCancel as unknown as Mock;

describe('migrate prompts', () => {
  beforeEach(() => {
    mockAutocomplete.mockReset();
    mockIsCancel.mockReset().mockReturnValue(false);
  });

  describe('migrateConfirm', () => {
    it('resolves true when the user answers yes', async () => {
      mockAutocomplete.mockResolvedValueOnce('Yes');
      await expect(migrateConfirm({ message: '?' })).resolves.toBe(true);
    });

    it('resolves false when the user answers no', async () => {
      mockAutocomplete.mockResolvedValueOnce('No');
      await expect(migrateConfirm({ message: '?' })).resolves.toBe(false);
    });

    it('offers No first when `initial` is false', async () => {
      mockAutocomplete.mockResolvedValueOnce('No');
      await migrateConfirm({ message: '?', initial: false });
      expect(mockAutocomplete.mock.calls[0][0].initialValue).toBe('No');
    });
  });

  describe('migrateChoice', () => {
    it('returns the chosen value rather than a keyed reply object', async () => {
      mockAutocomplete.mockResolvedValueOnce('b');
      await expect(
        migrateChoice({
          message: '?',
          choices: [{ value: 'a' }, { value: 'b' }],
        })
      ).resolves.toBe('b');
    });

    it('labels a choice with its value when no label is given', async () => {
      mockAutocomplete.mockResolvedValueOnce('a');
      await migrateChoice({ message: '?', choices: [{ value: 'a' }] });
      expect(mockAutocomplete.mock.calls[0][0].options).toEqual([
        { value: 'a', label: 'a' },
      ]);
    });
  });

  // Cancelling ends the process rather than returning, so `nx migrate` never
  // proceeds on a half-answered prompt.
  describe('cancellation', () => {
    it('ends as an interrupt when the user cancels', async () => {
      mockAutocomplete.mockResolvedValueOnce(Symbol.for('clack:cancel'));
      mockIsCancel.mockReturnValue(true);
      // All three are stubbed on purpose: a real `kill` would signal this test
      // worker, and a real `removeAllListeners` would strip its SIGINT handling.
      const removeAllListeners = vi
        .spyOn(process, 'removeAllListeners')
        .mockReturnValue(process);
      const kill = vi
        .spyOn(process, 'kill')
        .mockImplementation((() => true) as never);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('exited');
      }) as never);

      await expect(migrateConfirm({ message: '?' })).rejects.toThrow('exited');
      if (process.platform !== 'win32') {
        expect(kill).toHaveBeenCalledWith(process.pid, 'SIGINT');
      }
      expect(exit).toHaveBeenCalledWith(130);

      removeAllListeners.mockRestore();
      kill.mockRestore();
      exit.mockRestore();
    });
  });
});
