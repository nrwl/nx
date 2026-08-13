jest.mock('@clack/prompts', () => ({
  autocomplete: jest.fn(),
  isCancel: jest.fn(() => false),
}));

import { autocomplete, isCancel } from '@clack/prompts';
import { migrateChoice, migrateConfirm } from './safe-prompt';

const mockAutocomplete = autocomplete as unknown as jest.Mock;
const mockIsCancel = isCancel as unknown as jest.Mock;

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

  // Cancelling exits the process rather than returning, so `nx migrate` never
  // proceeds on a half-answered prompt.
  describe('cancellation', () => {
    it('exits with 130 when the user cancels', async () => {
      mockAutocomplete.mockResolvedValueOnce(Symbol.for('clack:cancel'));
      mockIsCancel.mockReturnValue(true);
      const exit = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('exited');
      }) as never);

      await expect(migrateConfirm({ message: '?' })).rejects.toThrow('exited');
      expect(exit).toHaveBeenCalledWith(130);

      exit.mockRestore();
    });
  });
});
