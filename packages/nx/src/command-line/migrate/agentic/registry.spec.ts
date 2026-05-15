import { AGENT_DEFINITIONS, getAgentDefinition } from './registry';

describe('agent registry', () => {
  it('exposes exactly the three v1-supported agents', () => {
    expect(AGENT_DEFINITIONS.map((definition) => definition.id)).toEqual([
      'claude-code',
      'codex',
      'opencode',
    ]);
  });

  it('looks up each definition by id', () => {
    expect(getAgentDefinition('claude-code')?.displayName).toBe('Claude Code');
    expect(getAgentDefinition('codex')?.displayName).toBe('OpenAI Codex');
    expect(getAgentDefinition('opencode')?.displayName).toBe('OpenCode');
  });
});
