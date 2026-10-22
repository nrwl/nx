import type { MockedFunction } from 'vitest';
import { shouldPrintConfigureAiAgentsDisclaimer } from './configure-ai-agents-disclaimer';

vi.mock('./detect-ai-agent', () => ({
  detectAiAgent: vi.fn(() => null),
}));

vi.mock('../native', () => ({
  isAiAgent: vi.fn(() => false),
}));

import { detectAiAgent } from './detect-ai-agent';
import { isAiAgent } from '../native';

describe('shouldPrintConfigureAiAgentsDisclaimer', () => {
  const outdated = [{ name: 'claude' as const, displayName: 'Claude Code' }];
  const mockedDetectAiAgent = detectAiAgent as MockedFunction<
    typeof detectAiAgent
  >;
  const mockedIsAiAgent = isAiAgent as MockedFunction<typeof isAiAgent>;

  beforeEach(() => {
    mockedDetectAiAgent.mockReturnValue(null);
    mockedIsAiAgent.mockReturnValue(false);
  });

  it('should not print when nothing is outdated', () => {
    expect(shouldPrintConfigureAiAgentsDisclaimer([])).toBe(false);
  });

  it('should print when no agent is running nx', () => {
    expect(shouldPrintConfigureAiAgentsDisclaimer(outdated)).toBe(true);
  });

  it('should not print for unsupported agents', () => {
    mockedIsAiAgent.mockReturnValue(true);

    expect(shouldPrintConfigureAiAgentsDisclaimer(outdated)).toBe(false);
  });

  it('should print when the detected supported agent is outdated', () => {
    mockedDetectAiAgent.mockReturnValue('claude');
    mockedIsAiAgent.mockReturnValue(true);

    expect(shouldPrintConfigureAiAgentsDisclaimer(outdated)).toBe(true);
  });

  it('should not print when a different supported agent is outdated', () => {
    mockedDetectAiAgent.mockReturnValue('cursor');
    mockedIsAiAgent.mockReturnValue(true);

    expect(shouldPrintConfigureAiAgentsDisclaimer(outdated)).toBe(false);
  });
});
