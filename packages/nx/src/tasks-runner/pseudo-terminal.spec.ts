import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { RustPseudoTerminal } from '../native';
import {
  createPseudoTerminal,
  PseudoTerminal,
  PseudoTtyProcess,
} from './pseudo-terminal';

function linuxPtyFds(): Set<string> | undefined {
  if (process.platform !== 'linux' || !existsSync('/proc/self/fd')) {
    return undefined;
  }
  const fds = new Set<string>();
  for (const name of readdirSync('/proc/self/fd')) {
    try {
      const target = readlinkSync(`/proc/self/fd/${name}`);
      if (target.includes('ptmx') || target.includes('/pts/')) {
        fds.add(name);
      }
    } catch {
      // The fd can close between readdir and readlink.
    }
  }
  return fds;
}

describe('PseudoTerminal', () => {
  let terminal: PseudoTerminal;
  beforeEach(() => {
    terminal = createPseudoTerminal(true);
  });

  afterAll(() => {
    terminal = undefined;
  });

  it('should run command', async () => {
    const childProcess = terminal.runCommand('echo "hello world"');
    const exitCode = await new Promise((resolve) =>
      childProcess.onExit(resolve)
    );
    expect(exitCode).toEqual(0);
  });

  // 1s (the jest-era budget) is too tight once the suite runs files in
  // parallel: spawning the pty and reaping the kill both contend for CPU.
  it('should kill a running command', { timeout: 10_000 }, async () => {
    const childProcess = terminal.runCommand(
      'sleep 3 && echo "hello world" > file.txt'
    );
    const exited = new Promise((resolve) => childProcess.onExit(resolve));
    childProcess.kill();
    expect(childProcess.isAlive).toEqual(false);
    expect(await exited).not.toEqual(0);
  });

  it('should subscribe to output', async () => {
    const childProcess = terminal.runCommand('echo "hello world"');
    let output = '';
    childProcess.onOutput((chunk) => {
      output += chunk;
    });

    await new Promise((resolve) => childProcess.onExit(resolve));
    expect(output.trim()).toContain('hello world');
  });

  describe('fork', () => {
    let originalNxTui: string | undefined;
    beforeEach(() => {
      originalNxTui = process.env.NX_TUI;
      process.env.NX_TUI = 'true';
    });
    afterEach(() => {
      if (originalNxTui === undefined) {
        delete process.env.NX_TUI;
      } else {
        process.env.NX_TUI = originalNxTui;
      }
    });

    async function forkStub(dir: string, ipcPath: string, id: string) {
      const forkScript = join(dir, 'fork.js');
      const received = join(dir, 'received.json');
      writeFileSync(
        forkScript,
        `require('fs').writeFileSync(${JSON.stringify(received)}, JSON.stringify({
          path: process.env.NX_PSEUDO_IPC_PATH,
          id: process.env.NX_PSEUDO_IPC_FORK_ID,
          args: process.argv.slice(2),
        }));`
      );
      const rustPseudoTerminal = new RustPseudoTerminal();
      const { code } = await new PseudoTtyProcess(
        rustPseudoTerminal,
        rustPseudoTerminal.fork(id, forkScript, ipcPath, dir, null, null, true),
        true
      ).getResults();
      return { code, received: JSON.parse(readFileSync(received, 'utf-8')) };
    }

    it('should hand the ipc path and fork id to the fork script verbatim', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'nx-fork-'));
      try {
        const ipcPath = join(dir, 'nx sockets', 'fp1-0.sock');
        const injected = join(dir, 'injected');
        const id = `app:build; touch ${injected}`;

        const { code, received } = await forkStub(dir, ipcPath, id);

        expect(code).toEqual(0);
        expect(received).toEqual({ path: ipcPath, id, args: [] });
        expect(existsSync(injected)).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('should run a fork script whose path contains quotes', async () => {
      const dir = mkdtempSync(join(tmpdir(), "nx fork's-"));
      try {
        const ipcPath = join(dir, 'fp1-0.sock');

        const { code, received } = await forkStub(dir, ipcPath, 'app:build');

        expect(code).toEqual(0);
        expect(received.path).toEqual(ipcPath);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  it('releases pty fds while finished tasks are still referenced', async () => {
    const baseline = linuxPtyFds();
    if (!baseline) {
      return;
    }
    const kept = [];
    for (let i = 0; i < 4; i++) {
      const terminal = createPseudoTerminal(true);
      const cp = terminal.runCommand('true', { quiet: true, tty: false });
      const result = await cp.getResults();
      expect(result.code).toEqual(0);
      kept.push(terminal, cp);
    }
    const after = linuxPtyFds();
    const leaked = [...after].filter((fd) => !baseline.has(fd));
    expect(leaked).toEqual([]);
  });

  if (process.env.CI !== 'true') {
    it('should be tty', async () => {
      const childProcess = terminal.runCommand(
        'node -p "if (process.stdout.isTTY === undefined) process.exit(1)"'
      );
      const code = await new Promise((resolve) => childProcess.onExit(resolve));
      expect(code).toEqual(0);
    });
  }
});
