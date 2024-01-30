import { fork, Serializable } from 'child_process';
import { join } from 'path';
import { PsuedoIPCClient } from './psuedo-ipc';

const psuedoIPCPath = process.argv[2];
const forkId = process.argv[3];

const script = join(__dirname, '../../bin/run-executor.js');

const childProcess = fork(script, {
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
});

const psuedoIPC = new PsuedoIPCClient(psuedoIPCPath);

psuedoIPC.onMessageFromParent(forkId, (message) => {
  childProcess.send(message);
});

psuedoIPC.notifyChildIsReady(forkId);

process.on('message', (message: Serializable) => {
  psuedoIPC.sendMessageToParent(message);
});

childProcess.on('exit', (code) => {
  psuedoIPC.close();
  process.exit(code);
});
