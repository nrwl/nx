import { confirmThirdPartyPreset, determineTemplate } from './prompts';

jest.mock('../utils/ci/is-ci', () => ({
  isCI: jest.fn(() => false),
}));

jest.mock('../utils/git/git', () => ({
  isGitAvailable: jest.fn(() => true),
}));

jest.mock('../utils/ai/ai-output', () => ({
  isAiAgent: jest.fn(() => false),
  detectAiAgentName: jest.fn(() => null),
}));

jest.mock('enquirer', () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
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
  const enquirer = require('enquirer').default;
  const { isCI } = require('../utils/ci/is-ci');
  const { isAiAgent } = require('../utils/ai/ai-output');

  beforeEach(() => {
    jest.clearAllMocks();
    (isCI as jest.Mock).mockReturnValue(false);
    (isAiAgent as jest.Mock).mockReturnValue(false);
  });

  it('prompts and returns true when user confirms', async () => {
    (enquirer.prompt as jest.Mock).mockResolvedValueOnce({ confirm: 'Yes' });
    await expect(confirmThirdPartyPreset('core', true)).resolves.toBe(true);
    expect(enquirer.prompt).toHaveBeenCalledTimes(1);
  });

  it('prompts and returns false when user declines', async () => {
    (enquirer.prompt as jest.Mock).mockResolvedValueOnce({ confirm: 'No' });
    await expect(confirmThirdPartyPreset('core', true)).resolves.toBe(false);
    expect(enquirer.prompt).toHaveBeenCalledTimes(1);
  });

  it('skips prompt and returns true in non-interactive mode', async () => {
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', false)
    ).resolves.toBe(true);
    expect(enquirer.prompt).not.toHaveBeenCalled();
  });

  it('skips prompt and returns true in CI', async () => {
    (isCI as jest.Mock).mockReturnValue(true);
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', true)
    ).resolves.toBe(true);
    expect(enquirer.prompt).not.toHaveBeenCalled();
  });

  it('skips prompt and returns true when running as an AI agent', async () => {
    (isAiAgent as jest.Mock).mockReturnValue(true);
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', true)
    ).resolves.toBe(true);
    expect(enquirer.prompt).not.toHaveBeenCalled();
  });
});
