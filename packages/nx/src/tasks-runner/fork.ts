import { fork, Serializable } from 'child_process';
import { join } from 'path';
import { PseudoIPCClient } from './pseudo-ipc';
import { signalToCode } from '../utils/exit-codes';

const pseudoIPCPath = process.argv[2];
const forkId = process.argv[3];

const script = join(__dirname, '../../bin/run-executor.js');

let execArgv: string[] | undefined;
if (process.env['NX_PSEUDO_TERMINAL_EXEC_ARGV']) {
  execArgv = process.env['NX_PSEUDO_TERMINAL_EXEC_ARGV'].split('|');
  delete process.env['NX_PSEUDO_TERMINAL_EXEC_ARGV'];
}

const childProcess = fork(script, {
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  env: process.env,
  execArgv,
});

const pseudoIPC = new PseudoIPCClient(pseudoIPCPath);

pseudoIPC.onMessageFromParent(
  forkId,
  (message) => {
    childProcess.send(message);
  },
  () => {
    // IPC connection closed
    cleanup();
    process.exit(0);
  },
  () => {
    // IPC connection error
    cleanup();
    process.exit(0);
  }
);

pseudoIPC.notifyChildIsReady(forkId);

process.on('message', (message: Serializable) => {
  pseudoIPC.sendMessageToParent(message);
});

childProcess.on('exit', (code, signal) => {
  cleanup();
  if (code === null) code = signalToCode(signal);
  process.exit(code);
});

let isCleaningUp = false;
function cleanup() {
  if (isCleaningUp) {
    return;
  }
  isCleaningUp = true;

  // Kill child process if still running
  if (childProcess && !childProcess.killed) {
    childProcess.kill('SIGTERM');
  }

  // Close IPC connection
  try {
    pseudoIPC.close();
  } catch {
    // Ignore errors when closing, connection might already be broken
  }
}

// Terminate the child process when exiting
process.on('exit', () => {
  cleanup();
});
process.on('SIGINT', () => {
  cleanup();
  process.exit(signalToCode('SIGINT'));
});
process.on('SIGTERM', () => {
  cleanup();
});
process.on('SIGHUP', () => {
  cleanup();
});
