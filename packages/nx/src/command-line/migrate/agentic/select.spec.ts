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
import { detectInstalledAgents } from './detect-installed';
import { output } from '../../../utils/output';
import { resolveAgentic } from './select';
import { DetectedInstalledAgent } from './types';

const mockIsAiAgent = isAiAgent as unknown as jest.Mock;
const mockPrompt = prompt as unknown as jest.Mock;
const mockDetect = detectInstalledAgents as unknown as jest.Mock;
const mockOutputLog = output.log as unknown as jest.Mock;
const mockOutputWarn = output.warn as unknown as jest.Mock;
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
    mockOutputWarn.mockReset();
    mockOutputError.mockReset();
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
      agentic: true,
      migrations: [{ prompt: 'x.md' }],
    });
    expect(result).toEqual({ kind: 'inside-agent' });
    expect(mockDetect).not.toHaveBeenCalled();
    expect(mockPrompt).not.toHaveBeenCalled();
  });

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
    mockPrompt.mockResolvedValueOnce({ enable: false });
    const result = await resolveAgentic({
      agentic: undefined,
      migrations: [{ prompt: 'x.md' }],
    });
    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('disabled');
  });

  it('enables the agentic flow when the up-front prompt is accepted', async () => {
    mockPrompt.mockResolvedValueOnce({ enable: true });
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

  it('aborts when the explicit agent id is not installed (other agents available)', async () => {
    mockDetect.mockResolvedValue([detected('claude-code'), detected('codex')]);
    await expect(
      resolveAgentic({
        agentic: 'opencode',
        migrations: [{ prompt: 'x.md' }],
      })
    ).rejects.toThrow(/requested agent "opencode" is not installed/i);
    expect(mockOutputError).toHaveBeenCalled();
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('aborts when the explicit agent id is not installed (only a different agent present)', async () => {
    mockDetect.mockResolvedValue([detected('codex')]);
    await expect(
      resolveAgentic({
        agentic: 'opencode',
        migrations: [{ prompt: 'x.md' }],
      })
    ).rejects.toThrow(/requested agent "opencode" is not installed/i);
    expect(mockOutputError).toHaveBeenCalled();
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('aborts when the explicit agent id is not installed (no agents present)', async () => {
    mockDetect.mockResolvedValue([]);
    await expect(
      resolveAgentic({
        agentic: 'opencode',
        migrations: [{ prompt: 'x.md' }],
      })
    ).rejects.toThrow(/requested agent "opencode" is not installed/i);
    expect(mockOutputError).toHaveBeenCalled();
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('aborts when agentic is enabled but no agents are installed', async () => {
    mockDetect.mockResolvedValue([]);
    await expect(
      resolveAgentic({
        agentic: true,
        migrations: [{ prompt: 'x.md' }],
      })
    ).rejects.toThrow(/No installed AI agent/);
    expect(mockOutputError).toHaveBeenCalled();
  });

  it('aborts when --agentic=true is passed in a non-TTY environment', async () => {
    setTty(false);
    await expect(
      resolveAgentic({
        agentic: true,
        migrations: [{ prompt: 'x.md' }],
      })
    ).rejects.toThrow(/interactive terminal/);
  });

  it('aborts when --agentic=<id> is passed in a non-TTY environment', async () => {
    setTty(false);
    await expect(
      resolveAgentic({
        agentic: 'claude-code',
        migrations: [{ prompt: 'x.md' }],
      })
    ).rejects.toThrow(/interactive terminal/);
  });

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
