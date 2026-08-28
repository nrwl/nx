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

  it('defaults to enabled', () => {
    delete process.env.NX_NEVER_CONFIGURE_AI_AGENTS;

    expect(isConfigureAiAgentsEnabled(undefined)).toBe(true);
    expect(isConfigureAiAgentsEnabled(null)).toBe(true);
    expect(isConfigureAiAgentsEnabled({})).toBe(true);
  });

  it('respects the workspace opt-out', () => {
    delete process.env.NX_NEVER_CONFIGURE_AI_AGENTS;

    expect(isConfigureAiAgentsEnabled({ neverConfigureAiAgents: true })).toBe(
      false
    );
    expect(isConfigureAiAgentsEnabled({ neverConfigureAiAgents: false })).toBe(
      true
    );
  });

  it('lets the environment override the workspace setting', () => {
    process.env.NX_NEVER_CONFIGURE_AI_AGENTS = 'true';
    expect(isConfigureAiAgentsEnabled({ neverConfigureAiAgents: false })).toBe(
      false
    );

    process.env.NX_NEVER_CONFIGURE_AI_AGENTS = 'false';
    expect(isConfigureAiAgentsEnabled({ neverConfigureAiAgents: true })).toBe(
      true
    );
  });

  it('ignores invalid environment values', () => {
    process.env.NX_NEVER_CONFIGURE_AI_AGENTS = '1';

    expect(isConfigureAiAgentsEnabled({ neverConfigureAiAgents: true })).toBe(
      false
    );
    expect(isConfigureAiAgentsEnabled({})).toBe(true);
  });
});
