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

import { isAiAgent } from '../../../native';
import { prompt } from 'enquirer';
import { output } from '../../../utils/output';
import { detectInstalledAgents } from './detect-installed';
import { resolveAgentic } from './select';
import { DetectedInstalledAgent } from './types';

const mockIsAiAgent = isAiAgent as unknown as jest.Mock;
const mockPrompt = prompt as unknown as jest.Mock;
const mockDetect = detectInstalledAgents as unknown as jest.Mock;
const mockOutputLog = output.log as unknown as jest.Mock;
const mockOutputError = output.error as unknown as jest.Mock;

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
    mockPrompt.mockResolvedValueOnce({ enable: 'no' });
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
    mockPrompt.mockResolvedValueOnce({ enable: 'yes' });
    mockDetect.mockResolvedValue([detected('claude-code')]);
    const result = await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'x.md' }],
    });
    expect(result).toMatchObject({
      kind: 'enabled',
      selectedAgent: { id: 'claude-code' },
    });
  });

  it('renders the up-front prompt as an autocomplete with Yes/No choices and per-choice hints', async () => {
    mockDetect.mockResolvedValue([detected('claude-code')]);
    mockPrompt.mockResolvedValueOnce({ enable: 'no' });
    await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'a.md' }, { prompt: 'b.md' }, {}],
    });
    expect(mockPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'autocomplete',
        message: 'Enable the agentic flow?',
        choices: [
          {
            name: 'yes',
            message: 'Yes',
            hint: 'Apply 2 prompt migrations and validate generator output with an AI agent',
          },
          {
            name: 'no',
            message: 'No',
            hint: 'Skip prompts and run generators without AI validation',
          },
        ],
      })
    );
  });

  it('singularizes the "Yes" hint when only one prompt migration is queued', async () => {
    mockDetect.mockResolvedValue([detected('claude-code')]);
    mockPrompt.mockResolvedValueOnce({ enable: 'no' });
    await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'only.md' }],
    });
    const call = mockPrompt.mock.calls[0][0];
    expect(call.choices[0].hint).toBe(
      'Apply 1 prompt migration and validate generator output with an AI agent'
    );
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

  it('aborts with an actionable list when --agentic=<id> is set but that agent is not among the other detected agents', async () => {
    mockDetect.mockResolvedValue([detected('claude-code'), detected('codex')]);
    await expect(
      resolveAgentic({
        agentic: 'opencode',
        migrations: [{ prompt: 'x.md' }],
      })
    ).rejects.toThrow(/requested agent "opencode" is not installed/i);
    expect(mockPrompt).not.toHaveBeenCalled();
    const errArg = mockOutputError.mock.calls[0][0];
    expect(errArg.title).toMatch(/is not installed\./);
    // The remediation must offer the "drop the explicit flag" path when
    // there ARE other agents to fall back to.
    expect(errArg.bodyLines.join('\n')).toMatch(
      /pass --agentic without an explicit agent/
    );
  });

  it('aborts without offering the "drop the explicit flag" remediation when --agentic=<id> is set and NO agents are installed', async () => {
    mockDetect.mockResolvedValue([]);
    await expect(
      resolveAgentic({
        agentic: 'opencode',
        migrations: [{ prompt: 'x.md' }],
      })
    ).rejects.toThrow(/requested agent "opencode" is not installed/i);
    expect(mockPrompt).not.toHaveBeenCalled();
    const errArg = mockOutputError.mock.calls[0][0];
    expect(errArg.title).toMatch(/no supported AI agent is installed/i);
    // The circular "pass --agentic without an explicit agent" remediation
    // must not appear when there's nothing to fall back to.
    expect(errArg.bodyLines.join('\n')).not.toMatch(
      /pass --agentic without an explicit agent/
    );
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
    'aborts when %s is passed in a non-TTY environment',
    async (_label, agentic) => {
      setTty(false);
      await expect(
        resolveAgentic({
          agentic,
          migrations: [{ prompt: 'x.md' }],
        })
      ).rejects.toThrow(/interactive terminal/);
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
