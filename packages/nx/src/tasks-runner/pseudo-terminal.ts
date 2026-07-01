import { Serializable } from 'child_process';
import * as os from 'os';
import { getForkedProcessOsSocketPath } from '../daemon/socket-utils';
import {
  ChildProcess,
  IS_WASM,
  RustPseudoTerminal,
  killProcessTree,
  killProcessTreeGraceful,
} from '../native';
import { PseudoIPCServer } from './pseudo-ipc';
import { RunningTask } from './running-tasks/running-task';
import { codeToSignal, messageToCode } from '../utils/exit-codes';

// Kill any children still alive when Nx exits. Terminals remove themselves once
// their children exit (see releaseChild), so finished runs skip a per-terminal scan.
const activePseudoTerminals = new Set<PseudoTerminal>();
process.on('exit', (code) => {
  activePseudoTerminals.forEach((t) => t.shutdown(code));
});

export function createPseudoTerminal(skipSupportCheck: boolean = false) {
  if (!skipSupportCheck && !PseudoTerminal.isSupported()) {
    throw new Error('Pseudo terminal is not supported on this platform.');
  }
  const pseudoTerminal = new PseudoTerminal(new RustPseudoTerminal());
  activePseudoTerminals.add(pseudoTerminal);
  return pseudoTerminal;
}

let id = 0;
export class PseudoTerminal {
  private pseudoIPCPath = getForkedProcessOsSocketPath(
    process.pid.toString() + '-' + id++
  );
  private pseudoIPC = new PseudoIPCServer(this.pseudoIPCPath);

  private initialized: boolean = false;

  private childProcesses = new Set<PseudoTtyProcess>();

  static isSupported() {
    return process.stdout.isTTY && supportedPtyPlatform();
  }

  constructor(private rustPseudoTerminal: RustPseudoTerminal) {}

  async init() {
    if (this.initialized) {
      return;
    }
    await this.pseudoIPC.init();
    this.initialized = true;
  }

  shutdown(code: number) {
    // Called from process.on('exit') — must be synchronous/best-effort.
    // Use fire-and-forget killProcessTree, not the async graceful variant.
    for (const cp of this.childProcesses) {
      try {
        const pid = cp.getPid();
        if (pid) {
          killProcessTree(pid, codeToSignal(code));
        }
      } catch {}
    }
    if (this.initialized) {
      this.pseudoIPC.close();
    }
  }

  // Once all children have exited, drop the process-exit handler and close IPC.
  private releaseChild(cp: PseudoTtyProcess) {
    this.childProcesses.delete(cp);
    if (this.childProcesses.size === 0) {
      activePseudoTerminals.delete(this);
      if (this.initialized) {
        this.pseudoIPC.close();
        this.initialized = false;
      }
    }
  }

  runCommand(
    command: string,
    {
      cwd,
      execArgv,
      jsEnv,
      quiet,
      tty,
    }: {
      cwd?: string;
      execArgv?: string[];
      jsEnv?: Record<string, string>;
      quiet?: boolean;
      tty?: boolean;
    } = {}
  ) {
    const cp = new PseudoTtyProcess(
      this.rustPseudoTerminal,
      this.rustPseudoTerminal.runCommand(
        command,
        cwd,
        jsEnv,
        execArgv,
        quiet,
        tty
      )
    );
    this.childProcesses.add(cp);
    cp.onExit(() => this.releaseChild(cp));
    return cp;
  }

  async fork(
    id: string,
    script: string,
    {
      cwd,
      execArgv,
      jsEnv,
      quiet,
      commandLabel,
    }: {
      cwd?: string;
      execArgv?: string[];
      jsEnv?: Record<string, string>;
      quiet?: boolean;
      commandLabel?: string;
    }
  ) {
    if (!this.initialized) {
      throw new Error('Call init() before forking processes');
    }
    const cp = new PseudoTtyProcessWithSend(
      this.rustPseudoTerminal,
      this.rustPseudoTerminal.fork(
        id,
        script,
        this.pseudoIPCPath,
        cwd,
        jsEnv,
        execArgv,
        quiet,
        commandLabel
      ),
      id,
      this.pseudoIPC
    );
    this.childProcesses.add(cp);
    cp.onExit(() => this.releaseChild(cp));

    await this.pseudoIPC.waitForChildReady(id);

    return cp;
  }

  sendMessageToChildren(message: Serializable) {
    this.pseudoIPC.sendMessageToChildren(message);
  }

  onMessageFromChildren(callback: (message: Serializable) => void) {
    this.pseudoIPC.onMessageFromChildren(callback);
  }
}

export class PseudoTtyProcess implements RunningTask {
  isAlive = true;

  private exitCallbacks: Array<(code: number, terminalOutput: string) => void> =
    [];
  private outputCallbacks: Array<(output: string) => void> = [];

  private terminalOutputChunks: string[] = [];

  constructor(
    public rustPseudoTerminal: RustPseudoTerminal,
    private childProcess: ChildProcess
  ) {
    childProcess.onOutput((output) => {
      this.terminalOutputChunks.push(output);
      this.outputCallbacks.forEach((cb) => cb(output));
    });

    childProcess.onExit((message) => {
      this.isAlive = false;

      const code = messageToCode(message);
      childProcess.cleanup();

      const terminalOutput = this.terminalOutputChunks.join('');
      this.terminalOutputChunks = [];
      this.exitCallbacks.forEach((cb) => cb(code, terminalOutput));
    });
  }

  async getResults(): Promise<{ code: number; terminalOutput: string }> {
    return new Promise((res) => {
      this.onExit((code, terminalOutput) => {
        res({ code, terminalOutput });
      });
    });
  }

  onExit(callback: (code: number, terminalOutput: string) => void): void {
    this.exitCallbacks.push(callback);
  }

  onOutput(callback: (message: string) => void): void {
    this.outputCallbacks.push(callback);
  }

  getPid(): number | undefined {
    return this.childProcess.getPid();
  }

  async kill(s?: NodeJS.Signals): Promise<void> {
    if (this.isAlive) {
      this.isAlive = false;
      const pid = this.childProcess.getPid();
      // Gracefully kill the entire process tree. This snapshots the tree
      // BEFORE sending signals, so even if the root exits quickly from
      // the signal, all descendants are already tracked and will be
      // cleaned up (including any reparented to init/PID 1).
      if (pid) {
        await killProcessTreeGraceful(pid, s || 'SIGTERM');
      } else {
        try {
          this.childProcess.kill(s || 'SIGTERM');
        } catch {
          // child may have already exited
        }
      }
    }
  }

  getParserAndWriter() {
    return this.childProcess.getParserAndWriter();
  }
}

export class PseudoTtyProcessWithSend extends PseudoTtyProcess {
  constructor(
    public rustPseudoTerminal: RustPseudoTerminal,
    _childProcess: ChildProcess,
    private id: string,
    private pseudoIpc: PseudoIPCServer
  ) {
    super(rustPseudoTerminal, _childProcess);
  }

  send(message: Serializable) {
    this.pseudoIpc.sendMessageToChild(this.id, message);
  }
}

function supportedPtyPlatform() {
  if (IS_WASM) {
    return false;
  }
  if (process.platform !== 'win32') {
    return true;
  }

  // Windows ConPTY support is enabled by default. The original blocker
  // (nrwl/nx#22358 — "issue with control chars") was filed against Nx 18.x
  // on a different terminal stack (older crossterm, no ratatui 0.30,
  // different portable-pty path). #22358 is closed/stale; its symptom
  // (`^[[12;1R` cursor-position-query response echoed to the terminal) is
  // the kind of bug terminal libraries typically resolve over time.
  //
  // Disabling ConPTY on Windows causes child task processes to inherit
  // the parent console's stdin and race the TUI's crossterm EventStream
  // for keystrokes — observed as a frozen TUI once any child opens its
  // stdin reader (Angular dev-server's r/q/u prompts, dotnet watch,
  // MCP STDIO servers). See nrwl/nx#33720 for the full analysis.
  //
  // Users who hit a Windows ConPTY regression can opt out with
  // NX_WINDOWS_PTY_SUPPORT='false'.
  if (process.env.NX_WINDOWS_PTY_SUPPORT === 'false') {
    return false;
  }

  let windowsVersion = os.release().split('.');
  let windowsBuild = windowsVersion[2];

  if (!windowsBuild) {
    return false;
  }

  // Mininum supported Windows version:
  // https://en.wikipedia.org/wiki/Windows_10,_version_1809
  // https://learn.microsoft.com/en-us/windows/console/createpseudoconsole#requirements
  if (+windowsBuild < 17763) {
    return false;
  } else {
    return true;
  }
}
