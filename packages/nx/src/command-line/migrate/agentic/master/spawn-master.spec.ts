import type { Mock } from 'vitest';
import { EventEmitter } from 'events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
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

type FakeChild = EventEmitter & {
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  kill: Mock;
};

// Emits `spawn` on the next tick unless told to fail before it; `exit` follows
// on demand, right after `spawn`, or on the first kill signal.
function fakeChild(
  opts: { startError?: Error; exitAfterSpawn?: boolean } = {
    exitAfterSpawn: true,
  }
): FakeChild {
  const ee = new EventEmitter() as FakeChild;
  ee.exitCode = null;
  ee.signalCode = null;
  ee.kill = vi.fn((signal: NodeJS.Signals) => {
    if (ee.signalCode !== null) return false;
    ee.signalCode = signal;
    setImmediate(() => ee.emit('exit', null, signal));
    return true;
  });
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

const runId = '20260715T101530-3f9a1c02';
// Real, with the run dir the orchestrator would have created: the session
// recreates the handoffs directory under it.
const runRoot = mkdtempSync(join(tmpdir(), 'nx-master-root-'));
mkdirSync(join(runRoot, '.nx', 'migrate-runs', runId), { recursive: true });
afterAll(() => rmSync(runRoot, { recursive: true, force: true }));
const sentinelPattern = new RegExp(
  `create the file (\\.nx/migrate-runs/${runId}/handoffs/session-complete-[0-9a-f]{8}) as your last action`
);

function input(
  overrides: Partial<SpawnMasterSessionInput> = {}
): SpawnMasterSessionInput {
  return {
    agent: agent(),
    runRoot,
    runId,
    runbookPath: join(runRoot, '.nx', 'migrate-runs', runId, 'RUNBOOK.md'),
    reconcileCommand: `npx nx migrate --run-id=${runId}`,
    sentinelPollIntervalMs: 5,
    gracefulExitMs: 20,
    forceKillWaitMs: 20,
    ...overrides,
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const pollsElapsed = (n: number) =>
  new Promise((resolve) => setTimeout(resolve, 5 * n));

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
      expect.stringMatching(sentinelPattern),
      expect.stringContaining(`npx nx migrate --run-id=${runId}`),
    ]);
    expect(args[3]).toContain(`.nx/migrate-runs/${runId}/RUNBOOK.md`);
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
    const beforeSpawnEvent = process.listeners('SIGINT').length;
    await tick();
    const afterSpawnEvent = process.listeners('SIGINT').length;
    child.emit('exit', null, 'SIGINT');

    expect(await pending).toEqual({ kind: 'exited' });
    expect(beforeSpawnEvent).toBe(sigintListeners + 1);
    expect(afterSpawnEvent).toBe(sigintListeners + 1);
  });

  it('settles on an error event after the agent started', async () => {
    const child = fakeChild({ exitAfterSpawn: false });
    mockSpawn.mockImplementation(() => child);

    const pending = spawnMasterSession(input());
    await tick();
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

  describe('session-complete sentinel', () => {
    let root: string;
    let handoffsDir: string;

    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), 'nx-master-'));
      handoffsDir = join(root, '.nx', 'migrate-runs', runId, 'handoffs');
      mkdirSync(handoffsDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(root, { recursive: true, force: true });
    });

    // The path the agent was told to create, resolved like the agent would.
    function promptedSentinel(): string {
      return join(
        root,
        mockSpawn.mock.calls[0][1][3].match(sentinelPattern)[1]
      );
    }

    it('closes the session once the file exists and removes the file', async () => {
      const child = fakeChild({ exitAfterSpawn: false });
      mockSpawn.mockImplementation(() => child);

      const pending = spawnMasterSession(input({ runRoot: root }));
      await pollsElapsed(3);
      const killsBeforeSentinel = child.kill.mock.calls.length;
      writeFileSync(promptedSentinel(), '');

      expect(await pending).toEqual({ kind: 'exited' });
      expect(killsBeforeSentinel).toBe(0);
      expect(child.kill).toHaveBeenCalledWith('SIGINT');
      expect(existsSync(promptedSentinel())).toBe(false);
    });

    it('sends nothing when the child exits on its own', async () => {
      const child = fakeChild({ exitAfterSpawn: false });
      mockSpawn.mockImplementation(() => child);

      const pending = spawnMasterSession(input({ runRoot: root }));
      await pollsElapsed(3);
      child.emit('exit', 0, null);

      expect(await pending).toEqual({ kind: 'exited' });
      expect(child.kill).not.toHaveBeenCalled();
    });

    it('ignores a sentinel written by another session of the same run', async () => {
      writeFileSync(join(handoffsDir, 'session-complete-00000000'), '');
      const child = fakeChild({ exitAfterSpawn: false });
      mockSpawn.mockImplementation(() => child);

      const pending = spawnMasterSession(input({ runRoot: root }));
      await pollsElapsed(3);
      writeFileSync(join(handoffsDir, 'session-complete-ffffffff'), '');
      await pollsElapsed(3);
      const killsBeforeOwnSentinel = child.kill.mock.calls.length;
      writeFileSync(promptedSentinel(), '');

      expect(await pending).toEqual({ kind: 'exited' });
      expect(killsBeforeOwnSentinel).toBe(0);
      expect(child.kill).toHaveBeenCalledWith('SIGINT');
      expect(promptedSentinel()).not.toMatch(/session-complete-(0{8}|f{8})$/);
    });

    it('recreates a removed handoffs directory so the sentinel can be written', async () => {
      rmSync(handoffsDir, { recursive: true });
      const child = fakeChild({ exitAfterSpawn: false });
      mockSpawn.mockImplementation(() => child);

      const pending = spawnMasterSession(input({ runRoot: root }));
      await pollsElapsed(3);
      writeFileSync(promptedSentinel(), '');

      expect(await pending).toEqual({ kind: 'exited' });
      expect(child.kill).toHaveBeenCalledWith('SIGINT');
    });

    it('refuses to spawn when something else stands where the handoffs directory belongs', async () => {
      rmSync(handoffsDir, { recursive: true });
      symlinkSync(root, handoffsDir);
      mockSpawn.mockImplementation(() => fakeChild());

      const result = await spawnMasterSession(input({ runRoot: root }));

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(result).toEqual({
        kind: 'spawn-failed',
        error: expect.objectContaining({
          message: expect.stringContaining(
            `something other than a directory at ${handoffsDir}`
          ),
        }),
      });
    });

    it('still reports the session as exited when the sentinel cannot be removed', async () => {
      const child = fakeChild({ exitAfterSpawn: false });
      mockSpawn.mockImplementation(() => child);

      const pending = spawnMasterSession(input({ runRoot: root }));
      await pollsElapsed(3);
      mkdirSync(promptedSentinel());
      writeFileSync(join(promptedSentinel(), 'child'), '');

      expect(await pending).toEqual({ kind: 'exited' });
      expect(child.kill).toHaveBeenCalledWith('SIGINT');
      expect(existsSync(promptedSentinel())).toBe(true);
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
