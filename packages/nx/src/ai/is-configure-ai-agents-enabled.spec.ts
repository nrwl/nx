import { isConfigureAiAgentsEnabled } from './is-configure-ai-agents-enabled';

describe('isConfigureAiAgentsEnabled', () => {
  const originalEnv = process.env.NX_NEVER_CONFIGURE_AI_AGENTS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NX_NEVER_CONFIGURE_AI_AGENTS;
    } else {
      process.env.NX_NEVER_CONFIGURE_AI_AGENTS = originalEnv;
    }
  });

  it('defaults to enabled when nxJson and env are unset', () => {
    delete process.env.NX_NEVER_CONFIGURE_AI_AGENTS;
    expect(isConfigureAiAgentsEnabled(undefined)).toBe(true);
    expect(isConfigureAiAgentsEnabled(null)).toBe(true);
    expect(isConfigureAiAgentsEnabled({})).toBe(true);
  });

  it('respects nxJson.neverConfigureAiAgents=true', () => {
    delete process.env.NX_NEVER_CONFIGURE_AI_AGENTS;
    expect(isConfigureAiAgentsEnabled({ neverConfigureAiAgents: true })).toBe(
      false
    );
  });

  it('treats nxJson.neverConfigureAiAgents=false as enabled', () => {
    delete process.env.NX_NEVER_CONFIGURE_AI_AGENTS;
    expect(isConfigureAiAgentsEnabled({ neverConfigureAiAgents: false })).toBe(
      true
    );
  });

  it('NX_NEVER_CONFIGURE_AI_AGENTS=true overrides nxJson=false', () => {
    process.env.NX_NEVER_CONFIGURE_AI_AGENTS = 'true';
    expect(isConfigureAiAgentsEnabled({ neverConfigureAiAgents: false })).toBe(
      false
    );
  });

  it('NX_NEVER_CONFIGURE_AI_AGENTS=false overrides nxJson=true', () => {
    process.env.NX_NEVER_CONFIGURE_AI_AGENTS = 'false';
    expect(isConfigureAiAgentsEnabled({ neverConfigureAiAgents: true })).toBe(
      true
    );
  });

  it('ignores other env var values and falls back to nxJson', () => {
    process.env.NX_NEVER_CONFIGURE_AI_AGENTS = '1';
    expect(isConfigureAiAgentsEnabled({ neverConfigureAiAgents: true })).toBe(
      false
    );
    expect(isConfigureAiAgentsEnabled({})).toBe(true);
  });
});
