import {
  confirmThirdPartyPreset,
  determineLinterOptions,
  determineTemplate,
} from './prompts';
import * as clack from '@clack/prompts';

jest.mock('../utils/ci/is-ci', () => ({
  isCI: jest.fn(() => false),
}));

jest.mock('../utils/ai/ai-output', () => ({
  isAiAgent: jest.fn(() => false),
  detectAiAgentName: jest.fn(() => null),
}));

jest.mock('@clack/prompts', () => ({
  __esModule: true,
  autocomplete: jest.fn(),
  multiselect: jest.fn(),
  text: jest.fn(),
  isCancel: jest.fn(() => false),
}));

jest.mock('../utils/output', () => ({
  output: { warn: jest.fn(), log: jest.fn() },
}));

describe('determineTemplate', () => {
  describe('non-interactive mode', () => {
    it('should return nrwl/empty-template when no preset or template is provided', async () => {
      const result = await determineTemplate({
        _: [],
        $0: '',
        interactive: false,
      });
      expect(result).toBe('nrwl/empty-template');
    });

    it('should return the provided template when --template is set', async () => {
      const result = await determineTemplate({
        _: [],
        $0: '',
        interactive: false,
        template: 'nrwl/react-template',
      });
      expect(result).toBe('nrwl/react-template');
    });

    it('should return custom when --preset is set', async () => {
      const result = await determineTemplate({
        _: [],
        $0: '',
        interactive: false,
        preset: 'react-monorepo',
      });
      expect(result).toBe('custom');
    });
  });

  describe('CI mode', () => {
    it('should return nrwl/empty-template in CI without preset or template', async () => {
      const { isCI } = require('../utils/ci/is-ci');
      (isCI as jest.Mock).mockReturnValueOnce(true);

      const result = await determineTemplate({
        _: [],
        $0: '',
        interactive: true,
      });
      expect(result).toBe('nrwl/empty-template');
    });
  });
});

describe('confirmThirdPartyPreset', () => {
  const { isCI } = require('../utils/ci/is-ci');
  const { isAiAgent } = require('../utils/ai/ai-output');

  beforeEach(() => {
    jest.clearAllMocks();
    (isCI as jest.Mock).mockReturnValue(false);
    (isAiAgent as jest.Mock).mockReturnValue(false);
  });

  it('prompts and returns true when user confirms', async () => {
    (clack.autocomplete as jest.Mock).mockResolvedValueOnce('Yes');
    await expect(confirmThirdPartyPreset('core', true)).resolves.toBe(true);
    expect(clack.autocomplete).toHaveBeenCalledTimes(1);
  });

  it('prompts and returns false when user declines', async () => {
    (clack.autocomplete as jest.Mock).mockResolvedValueOnce('No');
    await expect(confirmThirdPartyPreset('core', true)).resolves.toBe(false);
    expect(clack.autocomplete).toHaveBeenCalledTimes(1);
  });

  it('skips prompt and returns true in non-interactive mode', async () => {
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', false)
    ).resolves.toBe(true);
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('skips prompt and returns true in CI', async () => {
    (isCI as jest.Mock).mockReturnValue(true);
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', true)
    ).resolves.toBe(true);
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('skips prompt and returns true when running as an AI agent', async () => {
    (isAiAgent as jest.Mock).mockReturnValue(true);
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', true)
    ).resolves.toBe(true);
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('skips prompt and warning when trusted flag is set', async () => {
    const { output } = require('../utils/output');
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', true, true)
    ).resolves.toBe(true);
    expect(clack.autocomplete).not.toHaveBeenCalled();
    expect(output.warn).not.toHaveBeenCalled();
  });

  it('still prompts when trusted flag is false', async () => {
    (clack.autocomplete as jest.Mock).mockResolvedValueOnce('Yes');
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', true, false)
    ).resolves.toBe(true);
    expect(clack.autocomplete).toHaveBeenCalledTimes(1);
  });
});

describe('determineLinterOptions', () => {
  const { isCI } = require('../utils/ci/is-ci');

  beforeEach(() => {
    (clack.autocomplete as jest.Mock).mockReset();
    (isCI as jest.Mock).mockReturnValue(false);
  });

  it('should return the given linter without prompting', async () => {
    const result = await determineLinterOptions({
      linter: 'oxlint',
      interactive: true,
    });

    expect(result).toBe('oxlint');
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('should default to eslint without prompting when not interactive', async () => {
    const result = await determineLinterOptions({ interactive: false });

    expect(result).toBe('eslint');
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('should default to eslint without prompting in CI', async () => {
    (isCI as jest.Mock).mockReturnValue(true);

    const result = await determineLinterOptions({ interactive: true });

    expect(result).toBe('eslint');
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('should prompt when interactive', async () => {
    (clack.autocomplete as jest.Mock).mockResolvedValue('oxlint');

    const result = await determineLinterOptions({ interactive: true });

    expect(result).toBe('oxlint');
    expect(clack.autocomplete).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValue: 'eslint',
        options: expect.arrayContaining([
          expect.objectContaining({ value: 'eslint' }),
          expect.objectContaining({ value: 'oxlint' }),
          expect.objectContaining({ value: 'none' }),
        ]),
      })
    );
  });
});
