import { EventEmitter } from 'events';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));
jest.mock('enquirer', () => ({
  prompt: jest.fn(),
}));

import { spawn } from 'child_process';
import { prompt } from 'enquirer';
import { adaptSpawnForWindowsShim, runAgentic } from './runner';
import { AgentDefinition, DetectedInstalledAgent } from './types';

const mockSpawn = spawn as unknown as jest.Mock;
const mockPrompt = prompt as unknown as jest.Mock;

function makeDetected(): DetectedInstalledAgent {
  return {
    id: 'claude-code',
    displayName: 'Claude Code',
    binary: '/usr/local/bin/claude',
    source: 'path',
  };
}

function makeDefinition(): AgentDefinition {
  return {
    id: 'claude-code',
    displayName: 'Claude Code',
    binaryNames: ['claude'],
    wellKnownPaths: () => [],
    buildInteractive: jest.fn(() => ({
      args: ['--system-prompt', 'sys', 'user'],
      cwd: '/workspace',
    })),
  };
}

type FakeChild = EventEmitter & {
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  killed: boolean;
  kill: jest.Mock<boolean, [NodeJS.Signals?]>;
};

function fakeChild(
  opts: { exitOnKill?: boolean } = { exitOnKill: true }
): FakeChild {
  const ee = new EventEmitter() as FakeChild;
  ee.exitCode = null;
  ee.signalCode = null;
  ee.killed = false;
  ee.kill = jest.fn((signal?: NodeJS.Signals) => {
    if (ee.killed) return false;
    ee.killed = true;
    if (opts.exitOnKill) {
      setImmediate(() => {
        ee.signalCode = signal ?? 'SIGTERM';
        ee.emit('exit', null, signal);
      });
    }
    return true;
  });
  return ee;
}

describe('runAgentic', () => {
  let workspace: string;
  let handoffFilePath: string;
  let originalListeners: NodeJS.SignalsListener[];

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'nx-agentic-runner-'));
    handoffFilePath = join(workspace, 'handoff.json');
    mockSpawn.mockReset();
    mockPrompt.mockReset();
    originalListeners = process.listeners('SIGINT') as NodeJS.SignalsListener[];
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
    // Sanity: every test must clean up its SIGINT listener.
    expect(process.listeners('SIGINT').length).toBe(originalListeners.length);
  });

  function spawnWithHandoff(
    handoff: unknown,
    opts: { exit?: boolean } = { exit: true }
  ): FakeChild {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        writeFileSync(handoffFilePath, JSON.stringify(handoff));
        if (opts.exit) child.emit('exit', 0);
      });
      return child;
    });
    return child;
  }

  function defaultInvocation(workspaceRoot = workspace) {
    return {
      systemContext: 'sys',
      userPrompt: 'user',
      workspaceRoot,
    } as const;
  }

  it('passes binary, args, cwd, merged env, and stdio: inherit through to spawn', async () => {
    const definition = makeDefinition();
    (definition.buildInteractive as jest.Mock).mockReturnValue({
      args: ['--flag', 'value'],
      env: { CUSTOM: '1' },
      cwd: '/custom-cwd',
    });
    spawnWithHandoff({ status: 'success', summary: 'ok' });

    await runAgentic({
      detected: makeDetected(),
      definition,
      invocationContext: defaultInvocation('/workspace'),
      handoffFilePath,
    });

    const [binary, args, options] = mockSpawn.mock.calls[0];
    expect(binary).toBe('/usr/local/bin/claude');
    expect(args).toEqual(['--flag', 'value']);
    expect(options.stdio).toBe('inherit');
    expect(options.cwd).toBe('/custom-cwd');
    expect(options.env.CUSTOM).toBe('1');
    expect(options.env.PATH).toBe(process.env.PATH);
  });

  it('falls back to workspaceRoot as cwd when the spec omits it', async () => {
    const definition = makeDefinition();
    (definition.buildInteractive as jest.Mock).mockReturnValue({ args: [] });
    spawnWithHandoff({ status: 'success', summary: 'ok' });

    await runAgentic({
      detected: makeDetected(),
      definition,
      invocationContext: defaultInvocation('/ws'),
      handoffFilePath,
    });

    expect(mockSpawn.mock.calls[0][2].cwd).toBe('/ws');
  });

  it.each([
    [
      'success',
      { status: 'success', summary: 'applied' },
      { kind: 'success', summary: 'applied' },
    ],
    [
      'failed',
      { status: 'failed', summary: 'could not apply' },
      { kind: 'failed', summary: 'could not apply' },
    ],
    [
      'success with extras',
      { status: 'success', summary: 'done', changedFiles: ['a.ts'] },
      {
        kind: 'success',
        summary: 'done',
        extras: { changedFiles: ['a.ts'] },
      },
    ],
  ])(
    'maps handoff %s into the matching outcome',
    async (_label, handoff, expected) => {
      spawnWithHandoff(handoff);

      const outcome = await runAgentic({
        detected: makeDetected(),
        definition: makeDefinition(),
        invocationContext: defaultInvocation(),
        handoffFilePath,
      });

      expect(outcome).toEqual(expected);
    }
  );

  it.each([
    ['continue', 'ambiguous-continue'],
    ['abort', 'ambiguous-abort'],
  ])(
    'prompts when no handoff is written and respects "%s"',
    async (choice, expectedKind) => {
      const child = fakeChild();
      mockSpawn.mockImplementation(() => {
        setImmediate(() => child.emit('exit', 0));
        return child;
      });
      mockPrompt.mockResolvedValue({ choice });

      const outcome = await runAgentic({
        detected: makeDetected(),
        definition: makeDefinition(),
        invocationContext: defaultInvocation(),
        handoffFilePath,
      });

      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(outcome.kind).toBe(expectedKind);
    }
  );

  it.each([
    [
      'spawn emits an error event',
      () => {
        const child = fakeChild();
        mockSpawn.mockImplementation(() => {
          setImmediate(() => child.emit('error', new Error('boom')));
          return child;
        });
      },
    ],
    [
      'spawn throws synchronously',
      () => {
        mockSpawn.mockImplementation(() => {
          throw new Error('cannot spawn');
        });
      },
    ],
  ])('treats %s as exit-with-no-handoff', async (_label, setup) => {
    setup();
    mockPrompt.mockResolvedValue({ choice: 'abort' });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
    });

    expect(outcome.kind).toBe('ambiguous-abort');
  });

  it('closes the agent session with SIGINT when a valid handoff appears before the child exits', async () => {
    // Agent writes the handoff but does NOT exit on its own — only the
    // orchestrator-triggered SIGINT lets the run progress.
    const child = spawnWithHandoff(
      { status: 'success', summary: 'done' },
      { exit: false }
    );

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
      handoffPollIntervalMs: 5,
    });

    expect(child.kill).toHaveBeenCalledWith('SIGINT');
    expect(outcome).toEqual({ kind: 'success', summary: 'done' });
  });

  it('does NOT close the session when the handoff file is written in the wrong shape', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        // Wrong-shape: missing `summary`. waitForValidHandoff must stay
        // pending so the user can see the agent continue or correct itself.
        writeFileSync(handoffFilePath, JSON.stringify({ status: 'success' }));
        setTimeout(() => child.emit('exit', 0), 50);
      });
      return child;
    });
    mockPrompt.mockResolvedValue({ choice: 'continue' });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
      handoffPollIntervalMs: 5,
    });

    expect(child.kill).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'ambiguous-continue' });
  });

  it('routes a Windows .cmd shim through the cmd.exe adapter', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value: 'win32',
    });
    const detected: DetectedInstalledAgent = {
      ...makeDetected(),
      binary: 'C:\\Users\\u\\AppData\\Roaming\\npm\\claude.cmd',
    };
    spawnWithHandoff({ status: 'success', summary: 'ok' });

    try {
      await runAgentic({
        detected,
        definition: makeDefinition(),
        invocationContext: defaultInvocation('C:\\workspace'),
        handoffFilePath,
      });

      // Adapter behavior is covered in detail by the adaptSpawnForWindowsShim
      // suite below; here we only verify runAgentic actually routes through it.
      const [binary, args] = mockSpawn.mock.calls[0];
      expect(binary).toMatch(/cmd\.exe$/i);
      expect(args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
    } finally {
      Object.defineProperty(process, 'platform', {
        configurable: true,
        writable: true,
        value: originalPlatform,
      });
    }
  });
});

describe('adaptSpawnForWindowsShim', () => {
  const originalPlatform = process.platform;
  const originalComspec = process.env.comspec;

  function setPlatform(value: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value,
    });
  }

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value: originalPlatform,
    });
    if (originalComspec === undefined) delete process.env.comspec;
    else process.env.comspec = originalComspec;
  });

  it('returns inputs untouched on non-Windows', () => {
    setPlatform('linux');
    const opts = { stdio: 'inherit' as const };
    const out = adaptSpawnForWindowsShim('/usr/bin/claude', ['a', 'b'], opts);
    expect(out.binary).toBe('/usr/bin/claude');
    expect(out.args).toEqual(['a', 'b']);
    expect(out.options).toBe(opts);
  });

  it('returns inputs untouched for non-shim binaries on Windows', () => {
    setPlatform('win32');
    const out = adaptSpawnForWindowsShim('C:\\bin\\claude.exe', ['a'], {});
    expect(out.binary).toBe('C:\\bin\\claude.exe');
    expect(out.args).toEqual(['a']);
    expect(out.options.windowsVerbatimArguments).toBeUndefined();
  });

  it.each([
    ['lowercase .cmd', 'C:\\Program Files\\agent\\bin\\claude.cmd'],
    ['.bat', 'C:\\tools\\agent.bat'],
    ['uppercase .CMD', 'C:\\bin\\AGENT.CMD'],
  ])(
    'wraps %s in cmd.exe /d /s /c with windowsVerbatimArguments',
    (_label, binary) => {
      setPlatform('win32');
      process.env.comspec = 'C:\\Windows\\System32\\cmd.exe';
      const out = adaptSpawnForWindowsShim(binary, ['--flag', 'value'], {
        stdio: 'inherit',
        windowsHide: true,
      });
      expect(out.binary).toBe('C:\\Windows\\System32\\cmd.exe');
      expect(out.args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
      expect(out.args[3]).toMatch(/^".*"$/);
      expect(out.options.windowsVerbatimArguments).toBe(true);
      // Pre-existing options are preserved.
      expect(out.options.stdio).toBe('inherit');
      expect(out.options.windowsHide).toBe(true);
    }
  );

  it('quotes args and caret-escapes cmd metacharacters (cross-spawn style)', () => {
    setPlatform('win32');
    const out = adaptSpawnForWindowsShim(
      'C:\\bin\\claude.cmd',
      ['arg with spaces', 'arg&with&amp', 'plain'],
      {}
    );
    // Each arg is double-quoted, then cmd.exe metacharacters (including the
    // quotes and the embedded spaces) are caret-escaped — cmd strips the
    // carets in its first parsing pass, leaving the original argument intact.
    const cmdLine = out.args[3];
    expect(cmdLine).toContain('^"arg^ with^ spaces^"');
    expect(cmdLine).toContain('^"arg^&with^&amp^"');
    expect(cmdLine).toContain('^"plain^"');
  });

  it('falls back to "cmd.exe" when comspec is unset', () => {
    setPlatform('win32');
    delete process.env.comspec;
    const out = adaptSpawnForWindowsShim('C:\\x.cmd', [], {});
    expect(out.binary).toBe('cmd.exe');
  });
});
