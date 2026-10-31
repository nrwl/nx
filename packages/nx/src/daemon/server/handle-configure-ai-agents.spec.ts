import { pathToFileURL } from 'node:url';
import {
  handleGetConfigureAiAgentsStatus,
  handleResetConfigureAiAgentsStatus,
} from './handle-configure-ai-agents';

vi.mock('node:url', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:url')>();
  return { ...actual, pathToFileURL: vi.fn(actual.pathToFileURL) };
});

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
    vi.mocked(pathToFileURL).mockClear();
  });

  afterEach(() => {
    delete process.env.NX_USE_LOCAL;
  });

  it('imports the agent utils through a file URL so absolute Windows paths load', async () => {
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

    expect(pathToFileURL).toHaveBeenCalledWith(
      require.resolve('nx/src/ai/utils.js')
    );
  });
});
