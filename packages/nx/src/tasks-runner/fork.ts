import { fork, Serializable } from 'child_process';

/**
 * Node IPC is specific to Node, but when spawning child processes in Rust, it won't have IPC.
 *
 * Thus, this is a wrapper which is spawned by Rust, which will create a Node IPC channel and pipe it to a ZeroMQ Channel
 *
 * Main Nx Process
 *   * Calls Rust Fork Function
 *     * `node fork.js`
 *     * Create a Rust - Node.js Agnostic Channel aka Psuedo IPC Channel
 *     * This returns RustChildProcess
 *         * RustChildProcess.onMessage(msg => ());
 *         * psuedo_ipc_channel.on_message() => tx.send(msg);
 *   * Node.js Fork Wrapper (fork.js)
 *     * fork(run-command.js) with `inherit` and `ipc`
 *         * This will create a Node IPC Channel
 *     * channel = getPsuedoIpcChannel(process.env.NX_IPC_CHANNEL_ID)
 *     * forkChildProcess.on('message', writeToPsuedoIpcChannel)
 */

// import { socket } from 'zeromq';
import { join } from 'path';
import { PsuedoIPC } from './psuedo-ipc';

const psuedoIPCPath = process.argv[2];

const script = join(__dirname, '../../bin/run-executor.js');

// const sock = socket('client');
// sock.bindSync(address);

const childProcess = fork(script, {
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
});

const psuedoIPC = new PsuedoIPC(psuedoIPCPath);

psuedoIPC.onMessageFromParent((message) => {
  childProcess.send(message);
});

process.on('message', (message: Serializable) => {
  psuedoIPC.sendMessageToParent(message);
});

// const subscriber = socket('sub');
//
// subscriber.connect(publisherAddress);
//
// subscriber.on('message', (_, message) => {
//   childProcess.send(message);
// });
//
// subscriber.subscribe('message');
//
// const publisher = socket('pub');
// publisher.connect(subscriberAddress);
//
// childProcess.on('message', (msg) => {
//   publisher.send(['message', msg.toString()]);
// });
