import {
  handleGetConfigureAiAgentsStatus,
  handleResetConfigureAiAgentsStatus,
} from './handle-configure-ai-agents';

vi.mock('../logger', () => ({ serverLogger: { log: vi.fn() } }));

vi.mock('../../ai/utils', () => ({
  supportedAgents: ['claude'],
  getAgentConfigurations: vi.fn().mockResolvedValue({
    fullyConfiguredAgents: [
      { name: 'claude', displayName: 'Claude Code', outdated: false },
    ],
    partiallyConfiguredAgents: [],
    nonConfiguredAgents: [],
  }),
}));

describe('handleGetConfigureAiAgentsStatus', () => {
  beforeEach(async () => {
    process.env.NX_USE_LOCAL = 'true';
    await handleResetConfigureAiAgentsStatus();
  });

  afterEach(() => {
    delete process.env.NX_USE_LOCAL;
  });

  it('returns the agent statuses once they are computed', async () => {
    await handleGetConfigureAiAgentsStatus();

    await vi.waitFor(async () => {
      const { response } = await handleGetConfigureAiAgentsStatus();
      expect(response).toEqual({
        fullyConfiguredAgents: [{ name: 'claude', displayName: 'Claude Code' }],
        outdatedAgents: [],
        partiallyConfiguredAgents: [],
        nonConfiguredAgents: [],
      });
    });
  });
});
