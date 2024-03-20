import { fork, Serializable } from 'child_process';
import { join } from 'path';
import { PseudoIPCClient } from './pseudo-ipc';

const pseudoIPCPath = process.argv[2];
const forkId = process.argv[3];

const script = join(__dirname, '../../bin/run-executor.js');

const childProcess = fork(script, {
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
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
