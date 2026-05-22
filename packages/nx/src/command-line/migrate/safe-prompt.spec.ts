jest.mock('enquirer', () => ({
  prompt: jest.fn(),
}));

import { prompt as enquirerPrompt } from 'enquirer';
import { migratePrompt } from './safe-prompt';

const mockPrompt = enquirerPrompt as unknown as jest.Mock;

describe('migratePrompt', () => {
  beforeEach(() => {
    mockPrompt.mockReset();
  });

  it('passes a single-question config through to enquirer and returns its result', async () => {
    mockPrompt.mockResolvedValueOnce({ shouldApply: true });
    const result = await migratePrompt<{ shouldApply: boolean }>({
      name: 'shouldApply',
      type: 'confirm',
      message: 'Apply?',
    });
    expect(result).toEqual({ shouldApply: true });
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it('injects an `options.cancel` handler into a single-question config so enquirer routes cancel through us instead of its broken built-in cleanup', async () => {
    mockPrompt.mockResolvedValueOnce({});
    await migratePrompt({
      name: 'x',
      type: 'confirm',
      message: '?',
    });
    const arg = mockPrompt.mock.calls[0][0];
    expect(typeof arg.cancel).toBe('function');
  });

  it('preserves every field of the original config alongside the injected cancel handler', async () => {
    mockPrompt.mockResolvedValueOnce({});
    await migratePrompt({
      name: 'x',
      type: 'select',
      message: 'Pick',
      choices: [{ name: 'a' }, { name: 'b' }],
      initial: 1,
    } as any);
    const arg = mockPrompt.mock.calls[0][0];
    expect(arg).toMatchObject({
      name: 'x',
      type: 'select',
      message: 'Pick',
      choices: [{ name: 'a' }, { name: 'b' }],
      initial: 1,
    });
    expect(typeof arg.cancel).toBe('function');
  });

  it('injects an `options.cancel` handler into every question of an array config', async () => {
    mockPrompt.mockResolvedValueOnce({});
    await migratePrompt([
      { name: 'first', type: 'confirm', message: '?' },
      { name: 'second', type: 'confirm', message: '?' },
    ]);
    const arg = mockPrompt.mock.calls[0][0];
    expect(Array.isArray(arg)).toBe(true);
    expect(arg).toHaveLength(2);
    expect(typeof arg[0].cancel).toBe('function');
    expect(typeof arg[1].cancel).toBe('function');
  });

  it('does not mutate the caller-provided config object', async () => {
    mockPrompt.mockResolvedValueOnce({});
    const original = { name: 'x', type: 'confirm', message: '?' };
    await migratePrompt(original as any);
    expect(original).not.toHaveProperty('cancel');
  });

  it('does not mutate caller-provided array entries', async () => {
    mockPrompt.mockResolvedValueOnce({});
    const a = { name: 'a', type: 'confirm', message: '?' };
    const b = { name: 'b', type: 'confirm', message: '?' };
    await migratePrompt([a, b] as any);
    expect(a).not.toHaveProperty('cancel');
    expect(b).not.toHaveProperty('cancel');
  });
});
