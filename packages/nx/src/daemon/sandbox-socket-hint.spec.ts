import type { MockedFunction } from 'vitest';
import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';
import { detectAiAgent } from '../native';
import { isSandbox } from '../utils/is-sandbox';
import { sandboxSocketHint } from './sandbox-socket-hint';

vi.mock('../native', async () => ({
  ...(await vi.importActual('../native')),
  detectAiAgent: vi.fn(() => null),
}));

// Mocked rather than driven through its environment variables: these cases are
// about the hint's gating, and `is-sandbox` has its own spec for which variables
// mean a sandbox.
vi.mock('../utils/is-sandbox', () => ({ isSandbox: vi.fn(() => false) }));

const mockDetectAiAgent = detectAiAgent as MockedFunction<typeof detectAiAgent>;
const mockIsSandbox = isSandbox as MockedFunction<typeof isSandbox>;

describe('sandboxSocketHint', () => {
  // Deliberately not the POSIX default (/tmp/.nx/sockets) so that a hardcoded
  // socket root in the module under test would fail these tests.
  const socketRoot = '/var/folders/nx-spec-sockets';

  beforeEach(() => {
    mockIsSandbox.mockReturnValue(true);
  });

  afterEach(() => {
    mockDetectAiAgent.mockReset();
    mockIsSandbox.mockReset();
  });

  const hint = (opts?: { certain?: boolean }) =>
    withEnvironmentVariables({ NX_SOCKET_DIR: socketRoot }, () =>
      sandboxSocketHint(opts)
    );

  it('should point at the socket root and the NX_SOCKET_DIR escape hatch', () => {
    const lines = hint().join('\n');

    expect(lines).toContain(socketRoot);
    expect(lines).toContain('NX_SOCKET_DIR');
  });

  it('should name every root the chain may use when NX_SOCKET_DIR is unset', () => {
    // Resolution walks a chain, so naming one root would be wrong wherever the
    // other was picked — and both are what a sandbox allowlist has to cover.
    // The home root is shown as `~/.nx`, which is what a committed allowlist
    // entry needs in order to expand per user.
    const lines = withEnvironmentVariables(
      { NX_SOCKET_DIR: undefined, NX_DAEMON_SOCKET_DIR: undefined },
      () => sandboxSocketHint()
    ).join('\n');

    expect(lines).toContain('/tmp/.nx');
    expect(lines).toContain('~/.nx');
  });

  it.each([true, false])(
    'should hedge by default, because the caller has no errno proving what failed (sandbox: %s)',
    (sandboxed: boolean) => {
      mockIsSandbox.mockReturnValue(sandboxed);

      expect(hint()[0]).toBe(
        `Nx could not use its unix socket under ${socketRoot}. Denied permission on that directory is a common cause.`
      );
    }
  );

  it.each([true, false])(
    'should state denied permission outright when the caller has an errno proving it (sandbox: %s)',
    (sandboxed: boolean) => {
      mockIsSandbox.mockReturnValue(sandboxed);

      expect(hint({ certain: true })[0]).toBe(
        `Nx was denied permission to use its unix socket under ${socketRoot}.`
      );
    }
  );

  it('should name denied permission rather than asserting a sandbox', () => {
    // A sandbox is the most common source but not the only one — a root-owned
    // socket dir left by `sudo nx` reads identically — so the lead line reports
    // what Nx observed and leaves the cause to the list.
    for (const certain of [true, false]) {
      expect(hint({ certain })[0]).toContain('permission');
      expect(hint({ certain })[0]).not.toContain('sandbox');
    }
  });

  it('should point Claude Code at the scoped allowlist rather than the blanket grant', () => {
    // The scoped entry covers binding, so `allowAllUnixSockets` buys nothing
    // for Nx while opening every socket on the machine to the sandbox.
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
    mockDetectAiAgent.mockReturnValue('copilot-cli');

    const lines = hint().join('\n');

    expect(lines).toContain('readwritePaths');
    expect(lines).toContain('~/.copilot/settings.json');
    expect(lines).not.toContain('allowUnixSockets');
    expect(lines).not.toContain('network_access');
  });

  it('should fall back to a setting-agnostic remedy for an unrecognised sandbox', () => {
    mockDetectAiAgent.mockReturnValue(null);

    const lines = hint().join('\n');

    expect(lines).toContain('create unix sockets under');
    expect(lines).not.toContain('allowUnixSockets');
    expect(lines).not.toContain('network_access');
  });

  it.each([true, false])(
    'should always offer NX_SOCKET_DIR, which needs no sandbox settings change (sandbox: %s)',
    (sandboxed: boolean) => {
      // An agent often cannot write its own sandbox settings, so the hint must
      // name a way forward that does not depend on editing them.
      mockIsSandbox.mockReturnValue(sandboxed);

      expect(hint().join('\n')).toContain('NX_SOCKET_DIR');
    }
  );

  describe('the configure-ai-agents remediation', () => {
    it('should be offered to Claude Code, which the generator writes sandbox settings for', () => {
      mockDetectAiAgent.mockReturnValue('claude');

      expect(hint().join('\n')).toContain('nx configure-ai-agents');
    });

    it.each(['codex', 'copilot-cli', 'gemini', null])(
      'should not be offered to %s, which the generator writes no sandbox settings for',
      (agent: string | null) => {
        // The generator's whole `sandbox` block sits inside `hasAgent('claude')`
        // (set-up-ai-agents.ts), so this bullet would send everyone else to a
        // command that writes nothing they need — and the very next bullet tells
        // them to edit the file by hand.
        mockDetectAiAgent.mockReturnValue(agent);

        expect(hint().join('\n')).not.toContain('nx configure-ai-agents');
      }
    );

    it('should not promise it can always run in place', () => {
      // configure-ai-agents writes the agent's own settings file, which agent
      // sandboxes routinely deny; saying so up front avoids a second dead end.
      mockDetectAiAgent.mockReturnValue('claude');

      expect(hint().join('\n')).toContain('regular terminal');
    });
  });

  describe('without a sandbox', () => {
    beforeEach(() => {
      mockIsSandbox.mockReturnValue(false);
    });

    it.each([true, false])(
      'should say nothing about a sandbox when none is running (certain: %s)',
      (certain: boolean) => {
        // A root-owned socket dir left by `sudo nx` reaches this hint on an
        // ordinary workstation. Naming a sandbox there sends the user to
        // settings for a thing they are not running, and the KB page is
        // entirely about sandboxes, so it goes with them.
        const lines = hint({ certain }).join('\n');

        expect(lines).not.toContain('sandbox');
        expect(lines).not.toContain('configure-ai-agents');
        expect(lines).not.toContain('nx.dev');
        // One remedy left, so it is stated rather than listed.
        expect(lines).not.toContain('one of the following');
        expect(lines).toContain('permission');
        expect(lines).toContain('NX_SOCKET_DIR');
      }
    );

    it.each(['claude', 'codex', 'copilot-cli'])(
      'should stay silent for %s on a failure no errno explains, because detecting the agent does not detect a sandbox',
      (agent: string) => {
        // Every Claude Code session sets CLAUDECODE; only a sandboxed one sets
        // SANDBOX_RUNTIME. Measured against Claude Code 2.1.248 with
        // `sandbox.enabled` true and false.
        mockDetectAiAgent.mockReturnValue(agent);

        const lines = hint().join('\n');

        expect(lines).not.toContain('sandbox');
        expect(lines).not.toContain('configure-ai-agents');
        expect(lines).toContain('NX_SOCKET_DIR');
      }
    );

    it('should still reach Copilot CLI on a proven refusal, whose sandbox sets no variable Nx can read', () => {
      // Measured on Copilot CLI 1.0.80: with sandboxing on, a bind under both
      // Nx roots is refused while one under $TMPDIR succeeds, and none of
      // SANDBOX_RUNTIME / MXC_SANDBOX / the other markers is set. The errno is
      // the only evidence Nx ever gets there, so gating on `isSandbox()` alone
      // would silence the hint for the agent it was written for.
      mockDetectAiAgent.mockReturnValue('copilot-cli');

      const lines = hint({ certain: true }).join('\n');

      expect(lines).toContain('readwritePaths');
      expect(lines).toContain('~/.copilot/settings.json');
    });

    it('should not blame a sandbox for a proven refusal in an unrecognised environment', () => {
      // The `sudo nx` root-owned socket dir reads identically to a sandbox
      // refusal, and here there is no agent to name a setting for.
      mockDetectAiAgent.mockReturnValue(null);

      const lines = hint({ certain: true }).join('\n');

      expect(lines).not.toContain('sandbox');
      expect(lines).toContain('NX_SOCKET_DIR');
    });
  });
});
