jest.mock('../../../native', () => ({
  isAiAgent: jest.fn(() => false),
}));
jest.mock('enquirer', () => ({
  prompt: jest.fn(),
}));
jest.mock('./detect-installed', () => ({
  detectInstalledAgents: jest.fn(),
}));
jest.mock('../../../utils/output', () => ({
  output: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('../../../utils/fileutils', () => ({
  ...jest.requireActual('../../../utils/fileutils'),
  writeJsonFile: jest.fn(),
  readJsonFile: jest.fn(() => ({})),
}));

import { isAiAgent } from '../../../native';
import { prompt } from 'enquirer';
import { output } from '../../../utils/output';
import { readJsonFile, writeJsonFile } from '../../../utils/fileutils';
import { detectInstalledAgents } from './detect-installed';
import { resolveAgentic } from './select';
import { DetectedInstalledAgent } from './types';

const mockIsAiAgent = isAiAgent as unknown as jest.Mock;
const mockPrompt = prompt as unknown as jest.Mock;
const mockDetect = detectInstalledAgents as unknown as jest.Mock;
const mockOutputLog = output.log as unknown as jest.Mock;
const mockOutputError = output.error as unknown as jest.Mock;
const mockOutputWarn = output.warn as unknown as jest.Mock;
const mockReadJsonFile = readJsonFile as unknown as jest.Mock;
const mockWriteJsonFile = writeJsonFile as unknown as jest.Mock;

function detected(
  id: 'claude-code' | 'codex' | 'opencode'
): DetectedInstalledAgent {
  return {
    id,
    displayName: id === 'claude-code' ? 'Claude Code' : id,
    binary: `/usr/local/bin/${id}`,
    source: 'path',
  };
}

const originalStdinTty = process.stdin.isTTY;
const originalStdoutTty = process.stdout.isTTY;

function setTty(enabled: boolean): void {
  Object.defineProperty(process.stdin, 'isTTY', {
    configurable: true,
    writable: true,
    value: enabled,
  });
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    writable: true,
    value: enabled,
  });
}

describe('resolveAgentic', () => {
  beforeEach(() => {
    mockIsAiAgent.mockReset();
    mockIsAiAgent.mockReturnValue(false);
    mockPrompt.mockReset();
    mockDetect.mockReset();
    mockOutputLog.mockReset();
    mockOutputError.mockReset();
    mockOutputWarn.mockReset();
    mockReadJsonFile.mockReset();
    mockReadJsonFile.mockReturnValue({});
    mockWriteJsonFile.mockReset();
    // Default to "no agents detected" — the few tests that exercise an enabled
    // flow override this with their own agent list.
    mockDetect.mockResolvedValue([]);
    setTty(true);
  });

  afterAll(() => {
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      writable: true,
      value: originalStdinTty,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      writable: true,
      value: originalStdoutTty,
    });
  });

  it('skips everything when running inside another AI agent (native detection)', async () => {
    mockIsAiAgent.mockReturnValue(true);
    const result = await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'x.md' }],
    });
    expect(result).toEqual({ kind: 'inside-agent' });
    expect(mockDetect).not.toHaveBeenCalled();
    expect(mockPrompt).not.toHaveBeenCalled();
    expect(mockOutputLog).toHaveBeenCalledTimes(1);
    expect(mockOutputLog.mock.calls[0][0].title).not.toMatch(/explicit/i);
  });

  it.each([
    ['--agentic=true', true],
    ['--agentic=<id>', 'claude-code'],
  ])(
    'notes the explicit %s flag is ignored when inside an outer AI agent',
    async (_label, agentic) => {
      mockIsAiAgent.mockReturnValue(true);
      const result = await resolveAgentic({
        agentic,
        migrations: [{ prompt: 'x.md' }],
      });
      expect(result).toEqual({ kind: 'inside-agent' });
      expect(mockOutputLog).toHaveBeenCalledTimes(1);
      expect(mockOutputLog.mock.calls[0][0].title).toMatch(
        /explicit --agentic flag is ignored/i
      );
    }
  );

  it('returns disabled when --agentic=false, without detection or prompts', async () => {
    const result = await resolveAgentic({
      agentic: false,
      migrations: [{ prompt: 'x.md' }],
    });
    expect(result).toEqual({ kind: 'disabled' });
    expect(mockDetect).not.toHaveBeenCalled();
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('returns disabled silently when --agentic is undefined and no prompt migrations are queued', async () => {
    const result = await resolveAgentic({
      agentic: undefined,
      migrations: [{}, {}],
    });
    expect(result.kind).toBe('disabled');
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('fires the up-front prompt when --agentic is undefined and prompt migrations are queued', async () => {
    mockDetect.mockResolvedValue([detected('claude-code')]);
    mockPrompt.mockResolvedValueOnce({ choice: 'no-once' });
    const result = await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'x.md' }],
    });
    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('disabled');
  });

  it('skips the up-front prompt when --agentic is undefined and no agents are installed', async () => {
    mockDetect.mockResolvedValue([]);
    const result = await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'x.md' }],
    });
    expect(result.kind).toBe('disabled');
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('enables the agentic flow when the up-front prompt is accepted', async () => {
    mockPrompt.mockResolvedValueOnce({ choice: 'yes-once' });
    mockDetect.mockResolvedValue([detected('claude-code')]);
    const result = await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'x.md' }],
    });
    expect(result).toMatchObject({
      kind: 'enabled',
      selectedAgent: { id: 'claude-code' },
    });
    // "just this time" persists nothing.
    expect(mockWriteJsonFile).not.toHaveBeenCalled();
  });

  it('renders the up-front prompt as a select with 4 folded choices when one agent is installed', async () => {
    mockDetect.mockResolvedValue([detected('claude-code')]);
    mockPrompt.mockResolvedValueOnce({ choice: 'no-once' });
    await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'a.md' }, { prompt: 'b.md' }, {}],
    });
    const call = mockPrompt.mock.calls[0][0];
    expect(call.type).toBe('select');
    expect(call.message).toBe('Enable the agentic flow?');
    expect(call.choices.map((c: any) => c.name)).toEqual([
      'yes-once',
      'yes-flex',
      'no-once',
      'no-never',
    ]);
    expect(call.choices[0].hint).toBe(
      'Apply 2 prompt migrations and validate generator output with an AI agent'
    );
  });

  it('adds the "pin the agent" choice when multiple agents are installed', async () => {
    mockDetect.mockResolvedValue([detected('claude-code'), detected('codex')]);
    mockPrompt.mockResolvedValueOnce({ choice: 'no-once' });
    await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'a.md' }],
    });
    const call = mockPrompt.mock.calls[0][0];
    expect(call.choices.map((c: any) => c.name)).toEqual([
      'yes-once',
      'yes-flex',
      'yes-pin',
      'no-once',
      'no-never',
    ]);
  });

  it('singularizes the apply hint when only one prompt migration is queued', async () => {
    mockDetect.mockResolvedValue([detected('claude-code')]);
    mockPrompt.mockResolvedValueOnce({ choice: 'no-once' });
    await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'only.md' }],
    });
    const call = mockPrompt.mock.calls[0][0];
    expect(call.choices[0].hint).toBe(
      'Apply 1 prompt migration and validate generator output with an AI agent'
    );
  });

  describe('persisting the up-front prompt decision to nx.json', () => {
    it('does not persist for "Yes, just this time" or "No, just this time"', async () => {
      mockDetect.mockResolvedValue([detected('claude-code')]);
      mockPrompt.mockResolvedValueOnce({ choice: 'no-once' });
      const result = await resolveAgentic({
        agentic: undefined,
        migrations: [{ prompt: 'x.md' }],
      });
      expect(result.kind).toBe('disabled');
      expect(mockWriteJsonFile).not.toHaveBeenCalled();
    });

    it('persists `false` for "No, never"', async () => {
      mockDetect.mockResolvedValue([detected('claude-code')]);
      mockPrompt.mockResolvedValueOnce({ choice: 'no-never' });
      const result = await resolveAgentic({
        agentic: undefined,
        migrations: [{ prompt: 'x.md' }],
      });
      expect(result.kind).toBe('disabled');
      expect(mockWriteJsonFile).toHaveBeenCalledTimes(1);
      expect(mockWriteJsonFile.mock.calls[0][1]).toMatchObject({
        migrate: { agentic: false },
      });
    });

    it('persists `true` for "Yes, always" (flexible agent)', async () => {
      mockDetect.mockResolvedValue([detected('claude-code')]);
      mockPrompt.mockResolvedValueOnce({ choice: 'yes-flex' });
      const result = await resolveAgentic({
        agentic: undefined,
        migrations: [{ prompt: 'x.md' }],
      });
      expect(result).toMatchObject({
        kind: 'enabled',
        selectedAgent: { id: 'claude-code' },
      });
      expect(mockWriteJsonFile.mock.calls[0][1]).toMatchObject({
        migrate: { agentic: true },
      });
    });

    it('persists the selected agent id for "Yes, always with the same agent"', async () => {
      mockDetect.mockResolvedValue([
        detected('claude-code'),
        detected('codex'),
      ]);
      // First prompt: the folded enable choice. Second: the agent picker.
      mockPrompt
        .mockResolvedValueOnce({ choice: 'yes-pin' })
        .mockResolvedValueOnce({ id: 'codex' });
      const result = await resolveAgentic({
        agentic: undefined,
        migrations: [{ prompt: 'x.md' }],
      });
      expect(result).toMatchObject({
        kind: 'enabled',
        selectedAgent: { id: 'codex' },
      });
      expect(mockWriteJsonFile.mock.calls[0][1]).toMatchObject({
        migrate: { agentic: 'codex' },
      });
    });

    it('preserves existing migrate config when persisting', async () => {
      mockReadJsonFile.mockReturnValue({ migrate: { createCommits: true } });
      mockDetect.mockResolvedValue([detected('claude-code')]);
      mockPrompt.mockResolvedValueOnce({ choice: 'yes-flex' });
      await resolveAgentic({
        agentic: undefined,
        migrations: [{ prompt: 'x.md' }],
      });
      expect(mockWriteJsonFile.mock.calls[0][1]).toMatchObject({
        migrate: { createCommits: true, agentic: true },
      });
    });

    it('warns and continues when saving to nx.json fails', async () => {
      mockWriteJsonFile.mockImplementation(() => {
        throw new Error('disk full');
      });
      mockDetect.mockResolvedValue([detected('claude-code')]);
      mockPrompt.mockResolvedValueOnce({ choice: 'yes-flex' });
      const result = await resolveAgentic({
        agentic: undefined,
        migrations: [{ prompt: 'x.md' }],
      });
      // The migration still proceeds; the failed save only warns.
      expect(result).toMatchObject({
        kind: 'enabled',
        selectedAgent: { id: 'claude-code' },
      });
      expect(
        mockOutputWarn.mock.calls.some((c) =>
          /Could not save your agentic choice/i.test(c[0].title)
        )
      ).toBe(true);
    });

    it('does not persist when the agentic flow is requested explicitly via the flag', async () => {
      mockDetect.mockResolvedValue([detected('claude-code')]);
      const result = await resolveAgentic({
        agentic: true,
        migrations: [{ prompt: 'x.md' }],
      });
      expect(result.kind).toBe('enabled');
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockWriteJsonFile).not.toHaveBeenCalled();
    });
  });

  it('uses the single detected agent without firing a picker', async () => {
    mockDetect.mockResolvedValue([detected('claude-code')]);
    const result = await resolveAgentic({
      agentic: true,
      migrations: [{ prompt: 'x.md' }],
    });
    expect(result).toMatchObject({
      kind: 'enabled',
      selectedAgent: { id: 'claude-code' },
    });
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('fires the picker when multiple agents are detected', async () => {
    mockDetect.mockResolvedValue([detected('claude-code'), detected('codex')]);
    mockPrompt.mockResolvedValueOnce({ id: 'codex' });
    const result = await resolveAgentic({
      agentic: true,
      migrations: [{ prompt: 'x.md' }],
    });
    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      kind: 'enabled',
      selectedAgent: { id: 'codex' },
    });
  });

  it('uses the explicit agent id when it is installed', async () => {
    mockDetect.mockResolvedValue([
      detected('claude-code'),
      detected('opencode'),
    ]);
    const result = await resolveAgentic({
      agentic: 'opencode',
      migrations: [{ prompt: 'x.md' }],
    });
    expect(result).toMatchObject({
      kind: 'enabled',
      selectedAgent: { id: 'opencode' },
    });
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('warns and falls back to the picker when --agentic=<id> is set but that agent is not installed (others present)', async () => {
    mockDetect.mockResolvedValue([detected('claude-code'), detected('codex')]);
    mockPrompt.mockResolvedValueOnce({ id: 'codex' });
    const result = await resolveAgentic({
      agentic: 'opencode',
      migrations: [{ prompt: 'x.md' }],
    });
    // The picker fires over the installed agents instead of aborting.
    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      kind: 'enabled',
      selectedAgent: { id: 'codex' },
    });
    expect(mockOutputError).not.toHaveBeenCalled();
    expect(mockOutputWarn).toHaveBeenCalled();
    expect(mockOutputWarn.mock.calls[0][0].title).toMatch(
      /requested agent "opencode" is not installed/i
    );
  });

  it('warns and auto-uses the only installed agent when --agentic=<id> is set but that agent is not installed', async () => {
    mockDetect.mockResolvedValue([detected('claude-code')]);
    const result = await resolveAgentic({
      agentic: 'opencode',
      migrations: [{ prompt: 'x.md' }],
    });
    expect(mockPrompt).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      kind: 'enabled',
      selectedAgent: { id: 'claude-code' },
    });
    expect(mockOutputError).not.toHaveBeenCalled();
    expect(mockOutputWarn).toHaveBeenCalled();
    expect(mockOutputWarn.mock.calls[0][0].title).toMatch(
      /requested agent "opencode" is not installed/i
    );
  });

  it('errors when --agentic=<id> is set and NO agents are installed', async () => {
    mockDetect.mockResolvedValue([]);
    await expect(
      resolveAgentic({
        agentic: 'opencode',
        migrations: [{ prompt: 'x.md' }],
      })
    ).rejects.toThrow(/No installed AI agent/);
    expect(mockPrompt).not.toHaveBeenCalled();
    const errArg = mockOutputError.mock.calls[0][0];
    expect(errArg.title).toMatch(/no supported AI agent is installed/i);
    expect(errArg.bodyLines.join('\n')).toMatch(
      /install one of the supported agents/i
    );
  });

  it('aborts when agentic is enabled but no agents are installed', async () => {
    mockDetect.mockResolvedValue([]);
    await expect(
      resolveAgentic({
        agentic: true,
        migrations: [{ prompt: 'x.md' }],
      })
    ).rejects.toThrow(/No installed AI agent/);
  });

  it.each([
    ['--agentic=true', true],
    ['--agentic=<id>', 'claude-code'],
  ])(
    'warns and runs without the agentic flow when %s is passed in a non-TTY environment',
    async (_label, agentic) => {
      setTty(false);
      mockDetect.mockResolvedValue([detected('claude-code')]);
      const result = await resolveAgentic({
        agentic,
        migrations: [{ prompt: 'x.md' }],
      });
      expect(result).toEqual({ kind: 'disabled' });
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockOutputWarn).toHaveBeenCalled();
      expect(mockOutputWarn.mock.calls[0][0].title).toMatch(
        /interactive-only/i
      );
    }
  );

  it('resolves silently to disabled when --agentic is undefined in a non-TTY environment', async () => {
    setTty(false);
    const result = await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'x.md' }],
    });
    expect(result.kind).toBe('disabled');
    expect(mockPrompt).not.toHaveBeenCalled();
  });
});
