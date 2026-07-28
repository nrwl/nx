import { daemonClient } from '../daemon/client/client';
import { printConfigureAiAgentsDisclaimer } from './run-command';

jest.mock('../daemon/client/client', () => ({
  daemonClient: {
    enabled: jest.fn(),
    isServerAvailable: jest.fn(),
    getConfigureAiAgentsStatus: jest.fn(),
  },
}));

describe('printConfigureAiAgentsDisclaimer', () => {
  const client = daemonClient as jest.Mocked<typeof daemonClient>;

  beforeEach(() => {
    jest.resetAllMocks();
    client.enabled.mockReturnValue(true);
    client.isServerAvailable.mockResolvedValue(true);
  });

  it('gives up when the daemon accepts the request but never answers', async () => {
    // A daemon that is alive but busy — the state a long-lived continuous task
    // leaves it in. Without a bound this waits for the daemon's 20 minute
    // message timeout, long after the run summary has printed.
    client.getConfigureAiAgentsStatus.mockReturnValue(new Promise(() => {}));

    await expect(printConfigureAiAgentsDisclaimer()).resolves.toBeUndefined();
  });

  it('still reports outdated agents when the daemon answers', async () => {
    client.getConfigureAiAgentsStatus.mockResolvedValue({
      outdatedAgents: ['claude'],
    } as any);

    await expect(printConfigureAiAgentsDisclaimer()).resolves.toBeUndefined();
    expect(client.getConfigureAiAgentsStatus).toHaveBeenCalled();
  });
});
