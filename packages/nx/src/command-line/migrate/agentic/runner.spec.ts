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
import { runAgentic } from './runner';
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

function fakeChild(): EventEmitter {
  const ee = new EventEmitter();
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

  it('spawns the agent with the binary, args, cwd, and merged env', async () => {
    const detected = makeDetected();
    const definition = makeDefinition();
    (definition.buildInteractive as jest.Mock).mockReturnValue({
      args: ['--flag', 'value'],
      env: { CUSTOM: '1' },
      cwd: '/custom-cwd',
    });

    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        writeFileSync(
          handoffFilePath,
          JSON.stringify({ status: 'success', summary: 'ok' })
        );
        child.emit('exit', 0);
      });
      return child;
    });

    await runAgentic({
      detected,
      definition,
      invocationContext: {
        systemContext: 'sys',
        userPrompt: 'user',
        workspaceRoot: '/workspace',
      },
      handoffFilePath,
    });

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [binary, args, options] = mockSpawn.mock.calls[0];
    expect(binary).toBe('/usr/local/bin/claude');
    expect(args).toEqual(['--flag', 'value']);
    expect(options.stdio).toBe('inherit');
    expect(options.cwd).toBe('/custom-cwd');
    expect(options.env.CUSTOM).toBe('1');
    expect(options.env.PATH).toBe(process.env.PATH);
  });

  it('falls back to workspaceRoot as cwd when the spec omits it', async () => {
    const detected = makeDetected();
    const definition = makeDefinition();
    (definition.buildInteractive as jest.Mock).mockReturnValue({ args: [] });

    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        writeFileSync(
          handoffFilePath,
          JSON.stringify({ status: 'success', summary: 'ok' })
        );
        child.emit('exit', 0);
      });
      return child;
    });

    await runAgentic({
      detected,
      definition,
      invocationContext: {
        systemContext: 'sys',
        userPrompt: 'user',
        workspaceRoot: '/ws',
      },
      handoffFilePath,
    });

    expect(mockSpawn.mock.calls[0][2].cwd).toBe('/ws');
  });

  it('returns success when the handoff file reports success', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        writeFileSync(
          handoffFilePath,
          JSON.stringify({ status: 'success', summary: 'applied' })
        );
        child.emit('exit', 0);
      });
      return child;
    });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: {
        systemContext: 'sys',
        userPrompt: 'user',
        workspaceRoot: workspace,
      },
      handoffFilePath,
    });

    expect(outcome).toEqual({ kind: 'success', summary: 'applied' });
  });

  it('returns failed when the handoff file reports failed', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        writeFileSync(
          handoffFilePath,
          JSON.stringify({ status: 'failed', summary: 'could not apply' })
        );
        child.emit('exit', 0);
      });
      return child;
    });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: {
        systemContext: 'sys',
        userPrompt: 'user',
        workspaceRoot: workspace,
      },
      handoffFilePath,
    });

    expect(outcome).toEqual({ kind: 'failed', summary: 'could not apply' });
  });

  it('prompts the user when no handoff is written and respects "continue"', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => child.emit('exit', 0));
      return child;
    });
    mockPrompt.mockResolvedValue({ choice: 'continue' });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: {
        systemContext: 'sys',
        userPrompt: 'user',
        workspaceRoot: workspace,
      },
      handoffFilePath,
    });

    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ kind: 'ambiguous-continue' });
  });

  it('prompts the user when no handoff is written and respects "abort"', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => child.emit('exit', 0));
      return child;
    });
    mockPrompt.mockResolvedValue({ choice: 'abort' });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: {
        systemContext: 'sys',
        userPrompt: 'user',
        workspaceRoot: workspace,
      },
      handoffFilePath,
    });

    expect(outcome).toEqual({ kind: 'ambiguous-abort' });
  });

  it('treats spawn `error` events as exit-with-no-handoff', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => child.emit('error', new Error('boom')));
      return child;
    });
    mockPrompt.mockResolvedValue({ choice: 'abort' });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: {
        systemContext: 'sys',
        userPrompt: 'user',
        workspaceRoot: workspace,
      },
      handoffFilePath,
    });

    expect(outcome.kind).toBe('ambiguous-abort');
  });

  it('treats spawn throwing synchronously as exit-with-no-handoff', async () => {
    mockSpawn.mockImplementation(() => {
      throw new Error('cannot spawn');
    });
    mockPrompt.mockResolvedValue({ choice: 'abort' });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: {
        systemContext: 'sys',
        userPrompt: 'user',
        workspaceRoot: workspace,
      },
      handoffFilePath,
    });

    expect(outcome.kind).toBe('ambiguous-abort');
  });

  it('installs and removes a SIGINT handler around the child run', async () => {
    const child = fakeChild();
    const baseline = process.listeners('SIGINT').length;
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        // While the child is "running", an extra SIGINT listener must exist.
        expect(process.listeners('SIGINT').length).toBe(baseline + 1);
        writeFileSync(
          handoffFilePath,
          JSON.stringify({ status: 'success', summary: 'ok' })
        );
        child.emit('exit', 0);
      });
      return child;
    });

    await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: {
        systemContext: 'sys',
        userPrompt: 'user',
        workspaceRoot: workspace,
      },
      handoffFilePath,
    });
  });

  it('preserves extra handoff fields in `extras`', async () => {
    const child = fakeChild();
    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        writeFileSync(
          handoffFilePath,
          JSON.stringify({
            status: 'success',
            summary: 'done',
            changedFiles: ['a.ts'],
          })
        );
        child.emit('exit', 0);
      });
      return child;
    });

    const outcome = await runAgentic({
      detected: makeDetected(),
      definition: makeDefinition(),
      invocationContext: {
        systemContext: 'sys',
        userPrompt: 'user',
        workspaceRoot: workspace,
      },
      handoffFilePath,
    });

    expect(outcome).toEqual({
      kind: 'success',
      summary: 'done',
      extras: { changedFiles: ['a.ts'] },
    });
  });
});
