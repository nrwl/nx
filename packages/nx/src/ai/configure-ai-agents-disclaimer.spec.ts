import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { shouldPrintConfigureAiAgentsDisclaimer } from './configure-ai-agents-disclaimer';
import { agentsMdPath, getAgentRulesWrapped } from './constants';

jest.mock('./detect-ai-agent', () => ({
  detectAiAgent: jest.fn(() => null),
}));

import { detectAiAgent } from './detect-ai-agent';

describe('shouldPrintConfigureAiAgentsDisclaimer', () => {
  const outdated = [{ name: 'claude' as const, displayName: 'Claude Code' }];
  const mockedDetectAiAgent = detectAiAgent as jest.MockedFunction<
    typeof detectAiAgent
  >;

  beforeEach(() => {
    mockedDetectAiAgent.mockReturnValue(null);
  });

  it('should not print when nothing is outdated', () => {
    expect(shouldPrintConfigureAiAgentsDisclaimer([], '/tmp')).toBe(false);
  });

  it('should not print for unsupported agents when AGENTS.md has Nx rules', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nx-disclaimer-'));
    try {
      writeFileSync(
        agentsMdPath(dir),
        getAgentRulesWrapped({ writeNxCloudRules: false, useH1: true })
      );
      expect(shouldPrintConfigureAiAgentsDisclaimer(outdated, dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should print for unsupported agents when AGENTS.md is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nx-disclaimer-'));
    try {
      expect(existsSync(agentsMdPath(dir))).toBe(false);
      expect(shouldPrintConfigureAiAgentsDisclaimer(outdated, dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should print when the detected supported agent is outdated', () => {
    mockedDetectAiAgent.mockReturnValue('claude');

    expect(shouldPrintConfigureAiAgentsDisclaimer(outdated, '/tmp')).toBe(true);
  });

  it('should not print when a different supported agent is outdated', () => {
    mockedDetectAiAgent.mockReturnValue('cursor');

    expect(shouldPrintConfigureAiAgentsDisclaimer(outdated, '/tmp')).toBe(
      false
    );
  });
});
