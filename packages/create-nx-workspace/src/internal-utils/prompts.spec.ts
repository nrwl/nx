import type { Mock } from 'vitest';
import {
  confirmThirdPartyPreset,
  determineAiAgents,
  determineFormatterOptions,
  determineLinterOptions,
  determineNxCloudV2,
  determineTemplate,
} from './prompts';
import * as clack from '@clack/prompts';
import { detectAiAgentName, isAiAgent } from '../utils/ai/ai-output';
import { isCI } from '../utils/ci/is-ci';
import { output } from '../utils/output';

vi.mock('../utils/ci/is-ci', () => ({
  isCI: vi.fn(() => false),
}));

vi.mock('../utils/ai/ai-output', () => ({
  isAiAgent: vi.fn(() => false),
  detectAiAgentName: vi.fn(() => null),
}));

vi.mock('@clack/prompts', () => ({
  __esModule: true,
  autocomplete: vi.fn(),
  multiselect: vi.fn(),
  text: vi.fn(),
  isCancel: vi.fn(() => false),
}));

vi.mock('../utils/output', () => ({
  output: { warn: vi.fn(), log: vi.fn() },
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
      (isCI as Mock).mockReturnValueOnce(true);

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
  beforeEach(() => {
    vi.clearAllMocks();
    (isCI as Mock).mockReturnValue(false);
    (isAiAgent as Mock).mockReturnValue(false);
  });

  it('prompts and returns true when user confirms', async () => {
    (clack.autocomplete as Mock).mockResolvedValueOnce('Yes');
    await expect(confirmThirdPartyPreset('core', true)).resolves.toBe(true);
    expect(clack.autocomplete).toHaveBeenCalledTimes(1);
  });

  it('prompts and returns false when user declines', async () => {
    (clack.autocomplete as Mock).mockResolvedValueOnce('No');
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
    (isCI as Mock).mockReturnValue(true);
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', true)
    ).resolves.toBe(true);
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('skips prompt and returns true when running as an AI agent', async () => {
    (isAiAgent as Mock).mockReturnValue(true);
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', true)
    ).resolves.toBe(true);
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('skips prompt and warning when trusted flag is set', async () => {
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', true, true)
    ).resolves.toBe(true);
    expect(clack.autocomplete).not.toHaveBeenCalled();
    expect(output.warn).not.toHaveBeenCalled();
  });

  it('still prompts when trusted flag is false', async () => {
    (clack.autocomplete as Mock).mockResolvedValueOnce('Yes');
    await expect(
      confirmThirdPartyPreset('@my-org/nx-plugin', true, false)
    ).resolves.toBe(true);
    expect(clack.autocomplete).toHaveBeenCalledTimes(1);
  });
});

describe('determineLinterOptions', () => {
  beforeEach(() => {
    (clack.autocomplete as Mock).mockReset();
    (isCI as Mock).mockReturnValue(false);
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
    (isCI as Mock).mockReturnValue(true);

    const result = await determineLinterOptions({ interactive: true });

    expect(result).toBe('eslint');
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('should prompt when interactive', async () => {
    (clack.autocomplete as Mock).mockResolvedValue('oxlint');

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

describe('determineNxCloudV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isCI as Mock).mockReturnValue(false);
  });

  // The message choices are `{ value, name }` with `name` as the display text.
  // Mapping `name` into clack's `value` made every answer resolve to 'yes',
  // because the caller compares against 'skip'.
  it('offers the choice keys as values, not their labels', async () => {
    (clack.autocomplete as Mock).mockResolvedValueOnce('skip');

    await determineNxCloudV2({ _: [], $0: '', interactive: true });

    const { options } = (clack.autocomplete as Mock).mock.calls[0][0];
    // Exact, not arrayContaining: the opt-out choice ('never') must stay gone,
    // since it wrote `neverConnectToCloud` on an agent's behalf (NXC-4900).
    expect(options.map((o: { value: string }) => o.value)).toEqual([
      'yes',
      'skip',
    ]);
    expect(options.every((o: { value: string }) => o.value !== o.label)).toBe(
      true
    );
  });

  // Picks by LABEL and returns whatever value the code actually offered for it,
  // so the option mapping is exercised rather than mocked past. Returning a
  // fixed value here is what let the label/value inversion ship.
  it.each([
    ['Yes', 'yes'],
    ['Skip for now', 'skip'],
  ])('resolves the %s option to %s', async (label, expected) => {
    (clack.autocomplete as Mock).mockImplementationOnce(
      async ({ options }: { options: { value: string; label: string }[] }) =>
        options.find((o) => o.label.includes(label.slice(0, 8)))?.value
    );

    await expect(
      determineNxCloudV2({ _: [], $0: '', interactive: true })
    ).resolves.toBe(expected);
  });

  // Typing text that matches nothing leaves clack with an empty selection and
  // Enter submits `undefined`, which isCancel() does not catch.
  it('blocks a submit that matched no option', async () => {
    (clack.autocomplete as Mock).mockResolvedValueOnce('yes');

    await determineNxCloudV2({ _: [], $0: '', interactive: true });

    const { validate } = (clack.autocomplete as Mock).mock.calls[0][0];
    expect(validate(undefined)).toEqual(expect.any(String));
    expect(validate('skip')).toBeUndefined();
  });
});

describe('determineFormatterOptions', () => {
  beforeEach(() => {
    (clack.autocomplete as Mock).mockReset();
    (isCI as Mock).mockReturnValue(false);
  });

  it('should return the given formatter without prompting', async () => {
    const result = await determineFormatterOptions({
      formatter: 'oxfmt',
      interactive: true,
    });

    expect(result).toBe('oxfmt');
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('should default to prettier without prompting when not interactive', async () => {
    const result = await determineFormatterOptions({ interactive: false });

    expect(result).toBe('prettier');
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('should default to prettier without prompting in CI', async () => {
    (isCI as Mock).mockReturnValue(true);

    const result = await determineFormatterOptions({ interactive: true });

    expect(result).toBe('prettier');
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('should label oxfmt experimental while it is pre-1.0', async () => {
    (clack.autocomplete as Mock).mockResolvedValue('prettier');

    await determineFormatterOptions({ interactive: true });

    const [[question]] = (clack.autocomplete as Mock).mock.calls;
    const oxfmt = question.options.find(
      (o: { value: string }) => o.value === 'oxfmt'
    );
    expect(oxfmt.label).toContain('experimental');
  });

  it('should prompt when interactive', async () => {
    (clack.autocomplete as Mock).mockResolvedValue('oxfmt');

    const result = await determineFormatterOptions({ interactive: true });

    expect(result).toBe('oxfmt');
    expect(clack.autocomplete).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValue: 'prettier',
        options: expect.arrayContaining([
          expect.objectContaining({ value: 'prettier' }),
          expect.objectContaining({ value: 'oxfmt' }),
          expect.objectContaining({ value: 'none' }),
        ]),
      })
    );
  });
});

describe('determineAiAgents', () => {
  const mockDetect = detectAiAgentName as Mock;

  afterEach(() => mockDetect.mockReset());

  it('should configure an agent the generator has a branch for', async () => {
    mockDetect.mockReturnValue('claude');

    expect(await determineAiAgents({} as any)).toEqual(['claude']);
  });

  it('should not configure copilot-cli, which detection reports but the generator cannot set up', async () => {
    // Detection is broader than `supportedAgents`. Passing this through would
    // run setupAiAgentsGenerator with an agent no `hasAgent` branch matches:
    // no rules file, but still the unconditional .claude/* .gitignore entries.
    // Copilot CLI configuration is tracked separately (NXC-4622).
    mockDetect.mockReturnValue('copilot-cli');

    expect(await determineAiAgents({} as any)).toEqual([]);
  });

  it('should return nothing when no agent is detected', async () => {
    mockDetect.mockReturnValue(null);

    expect(await determineAiAgents({} as any)).toEqual([]);
  });
});
