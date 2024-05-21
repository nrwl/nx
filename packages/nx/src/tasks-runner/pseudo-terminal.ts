import { ChildProcess, RustPseudoTerminal } from '../native';
import { PseudoIPCServer } from './pseudo-ipc';
import { getForkedProcessOsSocketPath } from '../daemon/socket-utils';
import { Serializable } from 'child_process';
import * as os from 'os';

let pseudoTerminal: PseudoTerminal;

export function getPseudoTerminal(skipSupportCheck: boolean = false) {
  if (!skipSupportCheck && !PseudoTerminal.isSupported()) {
    throw new Error('Pseudo terminal is not supported on this platform.');
  }
  pseudoTerminal ??= new PseudoTerminal(new RustPseudoTerminal());

  return pseudoTerminal;
}

export class PseudoTerminal {
  private pseudoIPCPath = getForkedProcessOsSocketPath(process.pid.toString());
  private pseudoIPC = new PseudoIPCServer(this.pseudoIPCPath);

  private initialized: boolean = false;

  static isSupported() {
    return process.stdout.isTTY && supportedPtyPlatform();
  }

  constructor(private rustPseudoTerminal: RustPseudoTerminal) {
    this.setupProcessListeners();
  }

  async init() {
    if (this.initialized) {
      return;
    }
    await this.pseudoIPC.init();
    this.initialized = true;
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
    return new PseudoTtyProcess(
      this.rustPseudoTerminal.runCommand(
        command,
        cwd,
        jsEnv,
        execArgv,
        quiet,
        tty
      )
    );
  }

  async fork(
    id: string,
    script: string,
    {
      cwd,
      execArgv,
      jsEnv,
      quiet,
    }: {
      cwd?: string;
      execArgv?: string[];
      jsEnv?: Record<string, string>;
      quiet?: boolean;
    }
  ) {
    if (!this.initialized) {
      throw new Error('Call init() before forking processes');
    }
    const cp = new PseudoTtyProcessWithSend(
      this.rustPseudoTerminal.fork(
        id,
        script,
        this.pseudoIPCPath,
        cwd,
        jsEnv,
        execArgv,
        quiet
      ),
      id,
      this.pseudoIPC
    );

    await this.pseudoIPC.waitForChildReady(id);

    return cp;
  }

  sendMessageToChildren(message: Serializable) {
    this.pseudoIPC.sendMessageToChildren(message);
  }

  onMessageFromChildren(callback: (message: Serializable) => void) {
    this.pseudoIPC.onMessageFromChildren(callback);
  }

  private setupProcessListeners() {
    const shutdown = () => {
      this.shutdownPseudoIPC();
    };
    process.on('SIGINT', () => {
      this.shutdownPseudoIPC();
    });
    process.on('SIGTERM', () => {
      this.shutdownPseudoIPC();
    });
    process.on('SIGHUP', () => {
      this.shutdownPseudoIPC();
    });
    process.on('exit', () => {
      this.shutdownPseudoIPC();
    });
  }

  private shutdownPseudoIPC() {
    if (this.initialized) {
      this.pseudoIPC.close();
    }
  }
}

export class PseudoTtyProcess {
  isAlive = true;

  exitCallbacks = [];

  constructor(private childProcess: ChildProcess) {
    childProcess.onExit((message) => {
      this.isAlive = false;

      const exitCode = messageToCode(message);

      this.exitCallbacks.forEach((cb) => cb(exitCode));
    });
  }

  onExit(callback: (code: number) => void): void {
    this.exitCallbacks.push(callback);
  }

  onOutput(callback: (message: string) => void): void {
    this.childProcess.onOutput(callback);
  }

  kill(): void {
    try {
      this.childProcess.kill();
    } catch {
      // when the child process completes before we explicitly call kill, this will throw
      // do nothing
    } finally {
      if (this.isAlive == true) {
        this.isAlive = false;
      }
    }
  }
}

export class PseudoTtyProcessWithSend extends PseudoTtyProcess {
  constructor(
    _childProcess: ChildProcess,
    private id: string,
    private pseudoIpc: PseudoIPCServer
  ) {
    super(_childProcess);
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
