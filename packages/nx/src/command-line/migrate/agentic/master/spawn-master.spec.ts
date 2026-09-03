import type { Mock } from 'vitest';
import { EventEmitter } from 'events';
import { join } from 'path';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
  exec: vi.fn(),
  execFile: vi.fn(),
}));

import { spawn } from 'child_process';
import { DetectedInstalledAgent } from '../types';
import {
  adaptMasterSpawnForWindowsShim,
  spawnMasterSession,
  SpawnMasterSessionInput,
  WINDOWS_COMMAND_LINE_BUDGET,
} from './spawn-master';

const mockSpawn = spawn as unknown as Mock;

type FakeChild = EventEmitter & { kill: Mock };

// Emits `spawn` on the next tick unless told to fail before it; `exit` follows
// on demand or right after `spawn`.
function fakeChild(
  opts: { startError?: Error; exitAfterSpawn?: boolean } = {
    exitAfterSpawn: true,
  }
): FakeChild {
  const ee = new EventEmitter() as FakeChild;
  ee.kill = vi.fn();
  setImmediate(() => {
    if (opts.startError) {
      ee.emit('error', opts.startError);
      return;
    }
    ee.emit('spawn');
    if (opts.exitAfterSpawn) {
      setImmediate(() => ee.emit('exit', 0, null));
    }
  });
  return ee;
}

function agent(
  overrides: Partial<DetectedInstalledAgent> = {}
): DetectedInstalledAgent {
  return {
    id: 'claude-code',
    displayName: 'Claude Code',
    binary: '/usr/local/bin/claude',
    source: 'path',
    ...overrides,
  };
}

const runRoot = '/workspace';
const runId = '20260715T101530-3f9a1c02';

function input(
  overrides: Partial<SpawnMasterSessionInput> = {}
): SpawnMasterSessionInput {
  return {
    agent: agent(),
    runRoot,
    runId,
    runbookPath: join(runRoot, '.nx', 'migrate-runs', runId, 'RUNBOOK.md'),
    reconcileCommand: `npx nx migrate --run-id=${runId}`,
    ...overrides,
  };
}

describe('spawnMasterSession', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };
  let sigintListeners: number;

  beforeEach(() => {
    mockSpawn.mockReset();
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    sigintListeners = process.listeners('SIGINT').length;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = { ...originalEnv };
    expect(process.listeners('SIGINT').length).toBe(sigintListeners);
  });

  function setPlatform(platform: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', { value: platform });
  }

  it('spawns the agent once in the run root with stdio inherited and the prompts on argv', async () => {
    mockSpawn.mockImplementation(() => fakeChild());

    const result = await spawnMasterSession(input());

    expect(result).toEqual({ kind: 'exited' });
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [binary, args, options] = mockSpawn.mock.calls[0];
    expect(binary).toBe('/usr/local/bin/claude');
    expect(args).toEqual([
      '--allowedTools',
      `Edit(.nx/migrate-runs/${runId}/handoffs/**)`,
      '--append-system-prompt',
      expect.stringContaining(`.nx/migrate-runs/${runId}/RUNBOOK.md`),
      expect.stringContaining(`npx nx migrate --run-id=${runId}`),
    ]);
    expect(options).toEqual(
      expect.objectContaining({
        stdio: 'inherit',
        cwd: runRoot,
        windowsHide: true,
      })
    );
  });

  it('strips the wrapper and gate variables from the child env and applies the agent env', async () => {
    process.env.NX_MIGRATE_SKIP_INSTALL = 'true';
    process.env.NX_MIGRATE_USE_LOCAL = 'true';
    process.env.NX_MIGRATE_ORCHESTRATOR = 'true';
    process.env.UNRELATED = 'kept';
    mockSpawn.mockImplementation(() => fakeChild());

    await spawnMasterSession(
      input({
        agent: agent({
          id: 'opencode',
          displayName: 'OpenCode',
          binary: '/usr/local/bin/opencode',
        }),
      })
    );

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env).not.toHaveProperty('NX_MIGRATE_SKIP_INSTALL');
    expect(env).not.toHaveProperty('NX_MIGRATE_USE_LOCAL');
    expect(env).not.toHaveProperty('NX_MIGRATE_ORCHESTRATOR');
    expect(env.UNRELATED).toBe('kept');
    expect(JSON.parse(env.OPENCODE_CONFIG_CONTENT).agent['nx-migrate']).toEqual(
      { prompt: expect.stringContaining(`driving Nx migrate run ${runId}`) }
    );
  });

  it('swallows SIGINT from the moment the child exists and removes the listener on exit', async () => {
    const child = fakeChild({ exitAfterSpawn: false });
    mockSpawn.mockImplementation(() => child);

    const pending = spawnMasterSession(input());
    // Before the child's own `spawn` event has fired.
    expect(process.listeners('SIGINT').length).toBe(sigintListeners + 1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(process.listeners('SIGINT').length).toBe(sigintListeners + 1);

    child.emit('exit', null, 'SIGINT');
    expect(await pending).toEqual({ kind: 'exited' });
  });

  it('settles on an error event after the agent started', async () => {
    const child = fakeChild({ exitAfterSpawn: false });
    mockSpawn.mockImplementation(() => child);

    const pending = spawnMasterSession(input());
    await new Promise((resolve) => setImmediate(resolve));
    child.emit('error', new Error('lost'));

    expect(await pending).toEqual({ kind: 'exited' });
  });

  it('returns spawn-failed with the error when the process fails before starting', async () => {
    const error = Object.assign(new Error('spawn claude ENOENT'), {
      code: 'ENOENT',
    });
    mockSpawn.mockImplementation(() => fakeChild({ startError: error }));

    expect(await spawnMasterSession(input())).toEqual({
      kind: 'spawn-failed',
      error,
    });
    expect(process.listeners('SIGINT').length).toBe(sigintListeners);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it('returns spawn-failed when spawn throws', async () => {
    const error = new Error('EACCES');
    mockSpawn.mockImplementation(() => {
      throw error;
    });

    expect(await spawnMasterSession(input())).toEqual({
      kind: 'spawn-failed',
      error,
    });
  });

  describe('on Windows with an npm shim', () => {
    const comspec = 'C:\\Windows\\system32\\cmd.exe';
    const shim = 'C:\\Users\\dev\\AppData\\Roaming\\npm\\claude.cmd';

    beforeEach(() => {
      setPlatform('win32');
      process.env.comspec = comspec;
    });

    it('runs the shim through cmd.exe with expansion pinned and the arguments escaped', async () => {
      mockSpawn.mockImplementation(() => fakeChild());

      const result = await spawnMasterSession(
        input({ agent: agent({ binary: shim }) })
      );

      expect(result).toEqual({ kind: 'exited' });
      const [binary, args, options] = mockSpawn.mock.calls[0];
      expect(binary).toBe(comspec);
      expect(args.slice(0, 5)).toEqual(['/e:on', '/v:off', '/d', '/s', '/c']);
      // The command portion is caret-escaped twice, the arguments once.
      expect(
        args[5].startsWith(
          '"^^^"C:\\Users\\dev\\AppData\\Roaming\\npm\\claude.cmd^^^" ^"--allowedTools^" '
        )
      ).toBe(true);
      expect(args[5]).toContain('^"--append-system-prompt^"');
      expect(options.windowsVerbatimArguments).toBe(true);
      expect([binary, ...args].join(' ').length).toBeLessThan(
        WINDOWS_COMMAND_LINE_BUDGET / 2
      );
    });

    it('neutralizes a literal % in the binary path after caret escaping', () => {
      const adapted = adaptMasterSpawnForWindowsShim(
        'C:\\Users\\100%dev\\claude.cmd',
        ['--prompt', 'go'],
        { stdio: 'inherit' }
      );

      expect(adapted.args[5]).toContain('100%%cd:~,%dev');
      expect(adapted.args[5]).not.toContain('^%');
    });

    it.each<[string, Partial<SpawnMasterSessionInput>, () => void]>([
      [
        'the agent path',
        { agent: agent({ binary: `C:\\${'a'.repeat(7200)}\\claude.cmd` }) },
        () => {},
      ],
      [
        'the run id',
        { agent: agent({ binary: shim }), runId: 'r'.repeat(7200) },
        () => {},
      ],
      [
        'the cmd.exe path',
        { agent: agent({ binary: shim }) },
        () => {
          process.env.comspec = `C:\\${'c'.repeat(7200)}\\cmd.exe`;
        },
      ],
    ])(
      'refuses a command line over budget, naming %s among the variable parts',
      async (_label, overrides, arrange) => {
        arrange();
        mockSpawn.mockImplementation(() => fakeChild());

        const result = await spawnMasterSession(input(overrides));

        expect(mockSpawn).not.toHaveBeenCalled();
        expect(result.kind).toBe('spawn-failed');
        const message = (result as { error: Error }).error.message;
        expect(message).toContain(`nx stops at ${WINDOWS_COMMAND_LINE_BUDGET}`);
        expect(message).toContain('the cmd.exe path (');
        expect(message).toContain('the agent path (');
        expect(message).toContain('the run id (');
      }
    );

    it('refuses a line break in any argument', async () => {
      mockSpawn.mockImplementation(() => fakeChild());

      const result = await spawnMasterSession(
        input({ agent: agent({ binary: 'C:\\bad\nname\\claude.cmd' }) })
      );

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(result).toEqual({
        kind: 'spawn-failed',
        error: expect.objectContaining({
          message: expect.stringContaining('multi-line argument'),
        }),
      });
    });
  });
});
