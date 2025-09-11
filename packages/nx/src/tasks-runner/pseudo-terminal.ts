import { Serializable } from 'child_process';
import * as os from 'os';
import { getForkedProcessOsSocketPath } from '../daemon/socket-utils';
import { ChildProcess, IS_WASM, RustPseudoTerminal } from '../native';
import { PseudoIPCServer } from './pseudo-ipc';
import { RunningTask } from './running-tasks/running-task';
import { codeToSignal } from '../utils/exit-codes';

// Register single event listeners for all pseudo-terminal instances
const pseudoTerminalShutdownCallbacks: Array<(s: number) => void> = [];
process.on('exit', (code) => {
  pseudoTerminalShutdownCallbacks.forEach((cb) => cb(code));
});

export function createPseudoTerminal(skipSupportCheck: boolean = false) {
  if (!skipSupportCheck && !PseudoTerminal.isSupported()) {
    throw new Error('Pseudo terminal is not supported on this platform.');
  }
  const pseudoTerminal = new PseudoTerminal(new RustPseudoTerminal(), false);
  pseudoTerminalShutdownCallbacks.push(
    pseudoTerminal.shutdown.bind(pseudoTerminal)
  );
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

  constructor(
    private rustPseudoTerminal: RustPseudoTerminal,
    private useInlineTui: boolean = false
  ) {}

  async init() {
    if (this.initialized) {
      return;
    }
    await this.pseudoIPC.init();
    this.initialized = true;
  }

  shutdown(code: number) {
    for (const cp of this.childProcesses) {
      try {
        cp.kill(codeToSignal(code));
      } catch {}
    }
    if (this.initialized) {
      this.pseudoIPC.close();
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
    return cp;
  }

  runCommandWithInlineTui(
    command: string,
    {
      cwd,
      execArgv,
      jsEnv,
      commandLabel,
      enableInlineTui = true,
    }: {
      cwd?: string;
      execArgv?: string[];
      jsEnv?: Record<string, string>;
      commandLabel?: string;
      enableInlineTui?: boolean;
    } = {}
  ) {
    const cp = new PseudoTtyProcess(
      this.rustPseudoTerminal,
      this.rustPseudoTerminal.runCommandWithInlineTui(
        command,
        cwd,
        jsEnv,
        execArgv,
        commandLabel,
        enableInlineTui
      )
    );
    this.childProcesses.add(cp);
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
      useInlineTui,
    }: {
      cwd?: string;
      execArgv?: string[];
      jsEnv?: Record<string, string>;
      quiet?: boolean;
      commandLabel?: string;
      useInlineTui?: boolean;
    }
  ) {
    if (!this.initialized) {
      throw new Error('Call init() before forking processes');
    }
    
    // Use inline TUI if requested (overrides instance setting)
    const shouldUseInlineTui = useInlineTui ?? this.useInlineTui;
    
    let childProcess: ChildProcess;
    if (shouldUseInlineTui) {
      // Use the inline TUI mode
      const command = `node ${script} ${this.pseudoIPCPath} ${id}`;
      childProcess = this.rustPseudoTerminal.runCommandWithInlineTui(
        command,
        cwd,
        jsEnv,
        execArgv,
        commandLabel,
        true // enable inline TUI
      );
    } else {
      // Use regular fork
      childProcess = this.rustPseudoTerminal.fork(
        id,
        script,
        this.pseudoIPCPath,
        cwd,
        jsEnv,
        execArgv,
        quiet,
        commandLabel
      );
    }
    
    const cp = new PseudoTtyProcessWithSend(
      this.rustPseudoTerminal,
      childProcess,
      id,
      this.pseudoIPC
    );
    this.childProcesses.add(cp);

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

  private exitCallbacks: Array<(code: number) => void> = [];
  private outputCallbacks: Array<(output: string) => void> = [];

  private terminalOutput = '';

  constructor(
    public rustPseudoTerminal: RustPseudoTerminal,
    private childProcess: ChildProcess
  ) {
    childProcess.onOutput((output) => {
      this.terminalOutput += output;
      this.outputCallbacks.forEach((cb) => cb(output));
    });

    childProcess.onExit((message) => {
      this.isAlive = false;

      const code = messageToCode(message);
      childProcess.cleanup();

      this.exitCallbacks.forEach((cb) => cb(code));
    });
  }

  async getResults(): Promise<{ code: number; terminalOutput: string }> {
    return new Promise((res) => {
      this.onExit((code) => {
        res({ code, terminalOutput: this.terminalOutput });
      });
    });
  }

  onExit(callback: (code: number) => void): void {
    this.exitCallbacks.push(callback);
  }

  onOutput(callback: (message: string) => void): void {
    this.outputCallbacks.push(callback);
  }

  kill(s?: NodeJS.Signals): void {
    if (this.isAlive) {
      try {
        this.childProcess.kill(s);
      } catch {
        // when the child process completes before we explicitly call kill, this will throw
        // do nothing
      } finally {
        this.isAlive = false;
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

function messageToCode(message: string): number {
  if (message.startsWith('Terminated by ')) {
    switch (message.replace('Terminated by ', '').trim()) {
      case 'Termination':
        return 143;
      case 'Interrupt':
        return 130;
      default:
        return 128;
    }
  } else if (message.startsWith('Exited with code ')) {
    return parseInt(message.replace('Exited with code ', '').trim());
  } else if (message === 'Success') {
    return 0;
  } else {
    return 1;
  }
}

function supportedPtyPlatform() {
  if (IS_WASM) {
    return false;
  }
  if (process.platform !== 'win32') {
    return true;
  }

  // TODO: Re-enable Windows support when it's stable
  // Currently, there's an issue with control chars.
  // See: https://github.com/nrwl/nx/issues/22358
  if (process.env.NX_WINDOWS_PTY_SUPPORT !== 'true') {
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
