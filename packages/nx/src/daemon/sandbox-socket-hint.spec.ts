import type { MockedFunction } from 'vitest';
import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';
import { detectAiAgent, isAiAgent } from '../native';
import { sandboxSocketHint } from './sandbox-socket-hint';

vi.mock('../native', async () => ({
  ...(await vi.importActual('../native')),
  isAiAgent: vi.fn(() => false),
  detectAiAgent: vi.fn(() => null),
}));

const mockIsAiAgent = isAiAgent as MockedFunction<typeof isAiAgent>;
const mockDetectAiAgent = detectAiAgent as MockedFunction<typeof detectAiAgent>;

describe('sandboxSocketHint', () => {
  // Deliberately not the POSIX default (/tmp/.nx/sockets) so that a hardcoded
  // socket root in the module under test would fail these tests.
  const socketRoot = '/var/folders/nx-spec-sockets';

  afterEach(() => {
    mockIsAiAgent.mockReset();
    mockDetectAiAgent.mockReset();
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
    'should hedge by default, because the caller has no errno proving what failed (isAiAgent: %s)',
    (isAgent: boolean) => {
      mockIsAiAgent.mockReturnValue(isAgent);

      expect(hint()[0]).toBe(
        `Nx could not use its unix socket under ${socketRoot}. Denied permission on that directory is a common cause.`
      );
    }
  );

  it.each([true, false])(
    'should state denied permission outright when the caller has an errno proving it (isAiAgent: %s)',
    (isAgent: boolean) => {
      mockIsAiAgent.mockReturnValue(isAgent);

      expect(hint({ certain: true })[0]).toBe(
        `Nx was denied permission to use its unix socket under ${socketRoot}.`
      );
    }
  );

  it.each([true, false])(
    'should name denied permission rather than asserting a sandbox (isAiAgent: %s)',
    (isAgent: boolean) => {
      // A sandbox is the most common source but not the only one — a
      // root-owned socket dir left by `sudo nx` reads identically — so the
      // lead line reports what Nx observed and leaves the cause to the list.
      mockIsAiAgent.mockReturnValue(isAgent);

      for (const certain of [true, false]) {
        expect(hint({ certain })[0]).toContain('permission');
        expect(hint({ certain })[0]).not.toContain('sandbox');
      }
    }
  );

  it('should point Claude Code at the scoped allowlist rather than the blanket grant', () => {
    // The scoped entry covers binding, so `allowAllUnixSockets` buys nothing
    // for Nx while opening every socket on the machine to the sandbox.
    mockIsAiAgent.mockReturnValue(true);
    mockDetectAiAgent.mockReturnValue('claude');

    const lines = hint().join('\n');

    expect(lines).toContain('allowUnixSockets');
    expect(lines).toContain('.claude/settings.json');
    expect(lines).not.toContain('allowAllUnixSockets');
  });

  it('should name the setting Codex actually gates sockets on', () => {
    // Codex has no path-scoped socket setting: `writable_roots` alone leaves a
    // bind refused, and `network_access` is the switch that permits it. Naming
    // Claude's setting here would send Codex users to one that does not exist.
    mockIsAiAgent.mockReturnValue(true);
    mockDetectAiAgent.mockReturnValue('codex');

    const lines = hint().join('\n');

    expect(lines).toContain('network_access');
    expect(lines).toContain('writable_roots');
    expect(lines).toContain('~/.codex/config.toml');
    expect(lines).not.toContain('allowUnixSockets');
  });

  it('should send Copilot CLI to the user-level settings file', () => {
    // Copilot CLI is path-gated like Claude, but reads sandbox policy only from
    // ~/.copilot/settings.json, so naming a workspace file would send people to
    // one the CLI ignores. Distinct from `copilot`, which is the VS Code
    // extension's agent mode.
    mockIsAiAgent.mockReturnValue(true);
    mockDetectAiAgent.mockReturnValue('copilot-cli');

    const lines = hint().join('\n');

    expect(lines).toContain('readwritePaths');
    expect(lines).toContain('~/.copilot/settings.json');
    expect(lines).not.toContain('allowUnixSockets');
    expect(lines).not.toContain('network_access');
  });

  it('should fall back to a setting-agnostic remedy for an unrecognised sandbox', () => {
    mockIsAiAgent.mockReturnValue(false);
    mockDetectAiAgent.mockReturnValue(null);

    const lines = hint().join('\n');

    expect(lines).toContain('create unix sockets under');
    expect(lines).not.toContain('allowUnixSockets');
    expect(lines).not.toContain('network_access');
  });

  it.each([true, false])(
    'should always offer NX_SOCKET_DIR, which needs no sandbox settings change (isAiAgent: %s)',
    (isAgent: boolean) => {
      // An agent often cannot write its own sandbox settings, so the hint must
      // name a way forward that does not depend on editing them.
      mockIsAiAgent.mockReturnValue(isAgent);

      expect(hint().join('\n')).toContain('NX_SOCKET_DIR');
    }
  );

  it('should not promise that configure-ai-agents can always run in place', () => {
    // configure-ai-agents writes the agent's own settings file, which agent
    // sandboxes routinely deny; saying so up front avoids a second dead end.
    mockIsAiAgent.mockReturnValue(true);

    expect(hint().join('\n')).toContain('regular terminal');
  });
});
