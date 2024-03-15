import { ChildProcess, RustPseudoTerminal } from '../native';
import { PseudoIPCServer } from './pseudo-ipc';
import { FORKED_PROCESS_OS_SOCKET_PATH } from '../daemon/socket-utils';
import { Serializable } from 'child_process';
import { signalToCode } from '../utils/exit-codes';

let pseudoTerminal: PseudoTerminal;

export function getPseudoTerminal() {
  pseudoTerminal ??= new PseudoTerminal(new RustPseudoTerminal());

  return pseudoTerminal;
}

export class PseudoTerminal {
  private pseudoIPCPath = FORKED_PROCESS_OS_SOCKET_PATH(process.pid.toString());
  private pseudoIPC = new PseudoIPCServer(this.pseudoIPCPath);

  private initialized: boolean = false;

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
      jsEnv,
      quiet,
    }: {
      cwd?: string;
      jsEnv?: Record<string, string>;
      quiet?: boolean;
    } = {}
  ) {
    return new PseudoTtyProcess(
      this.rustPseudoTerminal.runCommand(command, cwd, jsEnv, quiet)
    );
  }

  async fork(
    id: string,
    script: string,
    {
      cwd,
      jsEnv,
      quiet,
    }: {
      cwd?: string;
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
