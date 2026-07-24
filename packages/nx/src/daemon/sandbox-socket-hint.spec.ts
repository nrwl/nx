import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';
import { isAiAgent } from '../native';
import { sandboxSocketHint } from './sandbox-socket-hint';

jest.mock('../native', () => ({
  ...jest.requireActual('../native'),
  isAiAgent: jest.fn(() => false),
}));

const mockIsAiAgent = isAiAgent as jest.MockedFunction<typeof isAiAgent>;

// Callers only reach the hint when `isSandbox()` is true or when the errno
// (connect EPERM/EACCES, a failed bind) already proves sockets are blocked, so
// the wording is allowed to name the cause outright.
describe('sandboxSocketHint', () => {
  const socketRoot = '/tmp/.nx/sockets';

  afterEach(() => {
    mockIsAiAgent.mockReset();
  });

  const hint = () =>
    withEnvironmentVariables({ NX_SOCKET_DIR: socketRoot }, () =>
      sandboxSocketHint()
    );

  it('should point at the socket root and the NX_SOCKET_DIR escape hatch for humans', () => {
    mockIsAiAgent.mockReturnValue(false);

    const lines = hint();

    expect(lines.join('\n')).toContain(socketRoot);
    expect(lines.join('\n')).toContain('NX_SOCKET_DIR');
  });

  it('should offer the configure-ai-agents remediation only to AI agents', () => {
    mockIsAiAgent.mockReturnValue(true);
    expect(hint().join('\n')).toContain('nx configure-ai-agents');

    mockIsAiAgent.mockReturnValue(false);
    expect(hint().join('\n')).not.toContain('nx configure-ai-agents');
  });

  it.each([true, false])(
    'should state the cause rather than hedging (isAiAgent: %s)',
    (isAgent: boolean) => {
      mockIsAiAgent.mockReturnValue(isAgent);

      expect(hint()[0]).toBe(
        `Your sandbox is blocking unix socket access. Nx creates its sockets under ${socketRoot}.`
      );
    }
  );
});
