import { fork, Serializable } from 'child_process';
import { join } from 'path';
import { PseudoIPCClient } from './pseudo-ipc';

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

pseudoIPC.onMessageFromParent(forkId, (message) => {
  childProcess.send(message);
});

pseudoIPC.notifyChildIsReady(forkId);

process.on('message', (message: Serializable) => {
  pseudoIPC.sendMessageToParent(message);
});

childProcess.on('exit', (code) => {
  pseudoIPC.close();
  process.exit(code);
});
