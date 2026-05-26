import { EventEmitter } from 'events';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execSync: jest.fn(),
}));
jest.mock('enquirer', () => ({
  prompt: jest.fn(),
}));

import { execSync, spawn } from 'child_process';
import { prompt } from 'enquirer';
import { output } from '../../../utils/output';
import { adaptSpawnForWindowsShim, runAgentic } from './runner';
import { AgentDefinition, DetectedInstalledAgent } from './types';

const mockSpawn = spawn as unknown as jest.Mock;
const mockExecSync = execSync as unknown as jest.Mock;
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

  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'nx-agentic-runner-'));
    handoffFilePath = join(workspace, 'handoff.json');
    mockSpawn.mockReset();
    mockExecSync.mockReset();
    mockPrompt.mockReset();
    warnSpy = jest.spyOn(output, 'warn').mockImplementation(() => {});
    originalListeners = process.listeners('SIGINT') as NodeJS.SignalsListener[];
  });

  afterEach(() => {
    // `try/finally` so a thrown `mockRestore` (e.g. spy already restored)
    // cannot leak the tmp workspace or skip the SIGINT-listener sanity check.
    try {
      warnSpy.mockRestore();
    } finally {
      rmSync(workspace, { recursive: true, force: true });
      // Sanity: every test must clean up its SIGINT listener.
      expect(process.listeners('SIGINT').length).toBe(originalListeners.length);
    }
  });

  // Read the lines passed to `output.warn` for the ambiguous-prompt cause
  // block. Tests previously inspected `mockPrompt.mock.calls[0][0].message`;
  // the cause is now rendered as a top-level warning ABOVE the prompt
  // (`output.warn.bodyLines`) and the prompt's message is single-line.
  // Scoped inside `describe('runAgentic')` so it cannot be called from a
  // suite where `warnSpy` is not installed.
  function ambiguousCauseLines(): string[] {
    for (const call of warnSpy.mock.calls) {
      const arg = call[0] as { title?: string; bodyLines?: string[] };
      if (arg?.title === 'The agent run ended without a usable handoff') {
        return arg.bodyLines ?? [];
      }
    }
    return [];
  }

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

  it('escalates to SIGKILL when the agent does not exit within the grace period after SIGINT (POSIX)', async () => {
    const child = fakeChild({ exitOnKill: false });
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        writeFileSync(
          handoffFilePath,
          JSON.stringify({ status: 'success', summary: 'done' })
        );
      });
      return child;
    });
    // SIGKILL is uncatchable — when it lands, the OS terminates the process
    // and Node emits `exit` with `signal: 'SIGKILL'`.
    child.kill.mockImplementation((signal?: NodeJS.Signals) => {
      if (signal === 'SIGKILL') {
        setImmediate(() => child.emit('exit', null, 'SIGKILL'));
      }
      return true;
    });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
      handoffPollIntervalMs: 5,
      gracefulExitMs: 20,
    });

    expect(child.kill).toHaveBeenCalledWith('SIGINT');
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    // SIGTERM is intentionally skipped — a process that ignores SIGINT
    // hits the same handler on SIGTERM.
    expect(child.kill).not.toHaveBeenCalledWith('SIGTERM');
    expect(outcome).toEqual({ kind: 'success', summary: 'done' });
  });

  it('returns within the post-kill safety bound when SIGKILL is also ignored (POSIX pathological D-state)', async () => {
    const child = fakeChild({ exitOnKill: false });
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        writeFileSync(
          handoffFilePath,
          JSON.stringify({ status: 'success', summary: 'done' })
        );
      });
      return child;
    });
    // Pathological: SIGKILL is sent but the child never emits `exit`
    // (e.g. uninterruptible kernel call). The 500ms post-kill safety bound
    // must let the orchestrator proceed regardless.
    child.kill.mockReturnValue(true);

    const start = Date.now();
    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
      handoffPollIntervalMs: 5,
      gracefulExitMs: 20,
    });
    const elapsed = Date.now() - start;

    expect(child.kill).toHaveBeenCalledWith('SIGINT');
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    expect(outcome).toEqual({ kind: 'success', summary: 'done' });
    // Sanity: orchestrator returned in a bounded time, did not hang.
    // gracefulExitMs (20) + FORCE_KILL_WAIT_MS (500) + FORCE_KILL_WAIT_MS
    // (500, second bound in the caller) + jitter. 5s is the upper bound to
    // catch a hang; the real number is ~1s.
    expect(elapsed).toBeLessThan(5_000);
  });

  it('uses taskkill /T /F instead of SIGINT to terminate the agent process tree on Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value: 'win32',
    });
    try {
      const child = fakeChild({ exitOnKill: false });
      // Mark the pid so we can assert taskkill was invoked with it.
      Object.defineProperty(child, 'pid', { value: 4242, configurable: true });
      mockSpawn.mockImplementation(() => {
        setImmediate(() => {
          writeFileSync(
            handoffFilePath,
            JSON.stringify({ status: 'success', summary: 'done' })
          );
        });
        return child;
      });
      mockExecSync.mockImplementation(() => {
        // Simulate taskkill walking the process tree and killing the agent;
        // Node emits `exit` after the underlying process is reaped.
        setImmediate(() => child.emit('exit', null, 'SIGTERM'));
        return Buffer.from('');
      });

      const outcome = await runAgentic({
        detected: makeDetected(),
        definition: makeDefinition(),
        invocationContext: defaultInvocation(),
        handoffFilePath,
        handoffPollIntervalMs: 5,
      });

      // SIGINT is skipped on Windows — it would TerminateProcess(cmd.exe)
      // and orphan the agent. taskkill walks the tree atomically instead.
      expect(child.kill).not.toHaveBeenCalled();
      expect(mockExecSync).toHaveBeenCalledTimes(1);
      const [taskkillCmd, opts] = mockExecSync.mock.calls[0];
      expect(taskkillCmd).toBe('taskkill /T /F /PID 4242');
      expect(opts.windowsHide).toBe(true);
      expect(opts.timeout).toBe(2_000);
      expect(outcome).toEqual({ kind: 'success', summary: 'done' });
    } finally {
      Object.defineProperty(process, 'platform', {
        configurable: true,
        writable: true,
        value: originalPlatform,
      });
    }
  });

  it('still returns when taskkill is missing or fails on Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value: 'win32',
    });
    try {
      const child = fakeChild({ exitOnKill: false });
      Object.defineProperty(child, 'pid', { value: 4242, configurable: true });
      mockSpawn.mockImplementation(() => {
        setImmediate(() => {
          writeFileSync(
            handoffFilePath,
            JSON.stringify({ status: 'success', summary: 'done' })
          );
        });
        return child;
      });
      // taskkill throws (binary missing, race with dead pid, etc.) — the
      // safety bound must still let the orchestrator proceed.
      mockExecSync.mockImplementation(() => {
        throw new Error('taskkill: not found');
      });

      const start = Date.now();
      const outcome = await runAgentic({
        detected: makeDetected(),
        definition: makeDefinition(),
        invocationContext: defaultInvocation(),
        handoffFilePath,
        handoffPollIntervalMs: 5,
      });
      const elapsed = Date.now() - start;

      expect(outcome).toEqual({ kind: 'success', summary: 'done' });
      expect(elapsed).toBeLessThan(5_000);
    } finally {
      Object.defineProperty(process, 'platform', {
        configurable: true,
        writable: true,
        value: originalPlatform,
      });
    }
  });

  it('passes a SIGINT during the agent run through without crashing and aborts directly afterward', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        // Invoke runAgentic's SIGINT listener directly. `process.emit('SIGINT',
        // …)` behaves inconsistently across jest workers (the signal name
        // collides with jest's own handlers), so we bypass it and trigger the
        // listener via its registration delta.
        const newListeners = (
          process.listeners('SIGINT') as NodeJS.SignalsListener[]
        ).filter((l) => !originalListeners.includes(l));
        for (const l of newListeners) l('SIGINT');
        setImmediate(() => child.emit('exit', 130, 'SIGINT'));
      });
      return child;
    });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
    });

    // userInterrupted=true short-circuits the ambiguous prompt.
    expect(mockPrompt).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('ambiguous-abort');
  });

  it('threads spawn errors into the ambiguous-prompt cause banner above the prompt', async () => {
    mockSpawn.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });
    mockPrompt.mockResolvedValue({ choice: 'abort' });

    await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
    });

    const lines = ambiguousCauseLines();
    expect(lines.join('\n')).toContain('Could not spawn the agent');
    expect(lines.join('\n')).toContain('ENOENT');
    // The prompt itself stays single-line — multi-line `message` triggers
    // enquirer's wrap-asymmetric redraw on narrow terminals.
    expect(mockPrompt.mock.calls[0][0].message).toBe(
      'How should nx migrate proceed?'
    );
  });

  it('threads a non-zero exit code into the ambiguous-prompt cause banner', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => child.emit('exit', 1, null));
      return child;
    });
    mockPrompt.mockResolvedValue({ choice: 'abort' });

    await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
    });

    expect(ambiguousCauseLines().join('\n')).toContain(
      'Agent exited with code 1'
    );
  });

  it('distinguishes a clean exit (code 0, no handoff) from a non-zero crash in the ambiguous-prompt cause banner', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      // Agent exits cleanly without writing a handoff — distinct from a
      // crash. The cause banner should NOT say "Agent exited with code 0"
      // (which sounds normal) but should say "exited cleanly without
      // writing a handoff" so the user can distinguish the two cases.
      setImmediate(() => child.emit('exit', 0, null));
      return child;
    });
    mockPrompt.mockResolvedValue({ choice: 'abort' });

    await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
    });

    const text = ambiguousCauseLines().join('\n');
    expect(text).toContain('exited cleanly (code 0) without writing a handoff');
    expect(text).not.toMatch(/Agent exited with code 0\./);
  });

  it('drops Ctrl+C-typical exit fields (code 130 / SIGINT) from the ambiguous-abort causeSummary when the user interrupted', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        const newListeners = (
          process.listeners('SIGINT') as NodeJS.SignalsListener[]
        ).filter((l) => !originalListeners.includes(l));
        for (const l of newListeners) l('SIGINT');
        setImmediate(() => child.emit('exit', 130, 'SIGINT'));
      });
      return child;
    });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
    });

    expect(outcome.kind).toBe('ambiguous-abort');
    // 130 / SIGINT / missing-handoff are all consequences of the user's own
    // Ctrl+C; the runner must not parrot them back as "the agent crashed".
    if (outcome.kind === 'ambiguous-abort') {
      expect(outcome.causeSummary).toBeUndefined();
    }
  });

  it('keeps a separate-crash diagnostic in the ambiguous-abort causeSummary even when the user interrupted', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        // Agent emits a non-Ctrl+C error event, the SIGINT listener fires,
        // then a non-typical (non-130, non-SIGINT) exit follows. The cause
        // should still surface — the user pressed Ctrl+C but there's also a
        // separate crash signal worth showing.
        child.emit('error', new Error('IPC channel disconnected'));
        const newListeners = (
          process.listeners('SIGINT') as NodeJS.SignalsListener[]
        ).filter((l) => !originalListeners.includes(l));
        for (const l of newListeners) l('SIGINT');
        setImmediate(() => child.emit('exit', 1, null));
      });
      return child;
    });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
    });

    expect(outcome.kind).toBe('ambiguous-abort');
    if (outcome.kind === 'ambiguous-abort') {
      expect(outcome.causeSummary).toEqual(
        expect.arrayContaining([
          expect.stringContaining('IPC channel disconnected'),
        ])
      );
    }
  });

  it('threads a handoff parse error into the ambiguous-prompt cause banner', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        writeFileSync(handoffFilePath, '{ not valid json');
        child.emit('exit', 0);
      });
      return child;
    });
    mockPrompt.mockResolvedValue({ choice: 'abort' });

    await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: defaultInvocation(),
      handoffFilePath,
    });

    expect(ambiguousCauseLines().join('\n')).toContain('invalid JSON');
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
