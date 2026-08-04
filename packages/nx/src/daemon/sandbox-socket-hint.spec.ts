import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';
import { isAiAgent } from '../native';
import { sandboxSocketHint } from './sandbox-socket-hint';

jest.mock('../native', () => ({
  ...jest.requireActual('../native'),
  isAiAgent: jest.fn(() => false),
}));

const mockIsAiAgent = isAiAgent as jest.MockedFunction<typeof isAiAgent>;

describe('sandboxSocketHint', () => {
  // Deliberately not the POSIX default (/tmp/.nx/sockets) so that a hardcoded
  // socket root in the module under test would fail these tests.
  const socketRoot = '/var/folders/nx-spec-sockets';

  afterEach(() => {
    mockIsAiAgent.mockReset();
  });

  const hint = (opts?: { certain?: boolean }) =>
    withEnvironmentVariables({ NX_SOCKET_DIR: socketRoot }, () =>
      sandboxSocketHint(opts)
    );

  it('should point at the socket root and the NX_SOCKET_DIR escape hatch for humans', () => {
    mockIsAiAgent.mockReturnValue(false);

    const lines = hint();

    expect(lines.join('\n')).toContain(socketRoot);
    expect(lines.join('\n')).toContain('NX_SOCKET_DIR');
  });

  it('should name every root the chain may use when NX_SOCKET_DIR is unset', () => {
    // Resolution walks a chain, so naming one root would be wrong wherever the
    // other was picked — and both are what a sandbox allowlist has to cover.
    // The home root is shown as `~/.nx`, which is what a committed allowlist
    // entry needs in order to expand per user.
    mockIsAiAgent.mockReturnValue(false);

    const lines = withEnvironmentVariables(
      { NX_SOCKET_DIR: undefined, NX_DAEMON_SOCKET_DIR: undefined },
      () => sandboxSocketHint()
    ).join('\n');

    expect(lines).toContain('/tmp/.nx');
    expect(lines).toContain('~/.nx');
  });

  it('should offer the configure-ai-agents remediation only to AI agents', () => {
    mockIsAiAgent.mockReturnValue(true);
    expect(hint().join('\n')).toContain('nx configure-ai-agents');

    mockIsAiAgent.mockReturnValue(false);
    expect(hint().join('\n')).not.toContain('nx configure-ai-agents');
  });

  it.each([true, false])(
    'should hedge by default, because a sandbox being present is not proof it blocked the socket (isAiAgent: %s)',
    (isAgent: boolean) => {
      mockIsAiAgent.mockReturnValue(isAgent);

      expect(hint()[0]).toBe(
        `A sandbox blocking unix socket access is a common cause. Nx creates its sockets under ${socketRoot}.`
      );
    }
  );

  it.each([true, false])(
    'should state the cause outright when the caller has an errno proving it (isAiAgent: %s)',
    (isAgent: boolean) => {
      mockIsAiAgent.mockReturnValue(isAgent);

      expect(hint({ certain: true })[0]).toBe(
        `Your sandbox is blocking unix socket access. Nx creates its sockets under ${socketRoot}.`
      );
    }
  );

  it('should tell sandboxes that only allowlist connections that they must also allow socket creation', () => {
    // Every caller is creating a socket or making the first connection to one
    // that does not exist yet, so a connect-only allowlist is never sufficient.
    mockIsAiAgent.mockReturnValue(true);

    expect(hint().join('\n')).toContain('allowAllUnixSockets');
  });

  it.each([true, false])(
    'should offer a remedy that needs no sandbox change (isAiAgent: %s)',
    (isAgent: boolean) => {
      // A denied bind is fatal to plugin isolation, and an agent often cannot
      // write its own sandbox settings, so the hint must always name a way
      // forward that does not depend on editing sandbox config.
      mockIsAiAgent.mockReturnValue(isAgent);

      expect(hint().join('\n')).toContain('NX_ISOLATE_PLUGINS=false');
    }
  );

  it('should not promise that configure-ai-agents can always run in place', () => {
    // configure-ai-agents writes the agent's own settings file, which agent
    // sandboxes routinely deny; saying so up front avoids a second dead end.
    mockIsAiAgent.mockReturnValue(true);

    expect(hint().join('\n')).toContain('regular terminal');
  });
});
