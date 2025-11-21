import { Socket, connect } from 'net';
import { performance } from 'perf_hooks';
import {
  consumeMessagesFromSocket,
  MESSAGE_END_SEQ,
  isJsonMessage,
} from '../../utils/consume-messages-from-socket';
import { serialize, getFullOsSocketPath } from '../socket-utils';

export interface Message extends Record<string, any> {
  type: string;
  data?: any;
}

const isDaemonClientLoggingEnabled = () =>
  process.env.NX_DAEMON_CLIENT_LOGGING === 'true';

const daemonLog = (...args: any[]) => {
  if (isDaemonClientLoggingEnabled()) {
    console.log('[DaemonSocketMessenger]', ...args);
  }
};

export class VersionMismatchError extends Error {
  constructor() {
    super('Version mismatch with daemon server');
    this.name = 'VersionMismatchError';
    Object.setPrototypeOf(this, VersionMismatchError.prototype);
  }
}

export class DaemonSocketMessenger {
  private socket: Socket | undefined;

  constructor() {}

  async sendMessage(messageToDaemon: Message, force?: 'v8' | 'json') {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call listen() first.');
    }
    daemonLog('Sending message type:', messageToDaemon.type);
    performance.mark(
      'daemon-message-serialization-start-' + messageToDaemon.type
    );
    const serialized = serialize(messageToDaemon, force);
    performance.mark(
      'daemon-message-serialization-end-' + messageToDaemon.type
    );
    performance.measure(
      'daemon-message-serialization-' + messageToDaemon.type,
      'daemon-message-serialization-start-' + messageToDaemon.type,
      'daemon-message-serialization-end-' + messageToDaemon.type
    );
    this.socket.write(serialized);
    // send EOT to indicate that the message has been fully written
    this.socket.write(MESSAGE_END_SEQ);
    daemonLog('Message sent');
  }

  async listen(
    onData: (message: string) => void,
    onClose: () => void = () => {},
    onError: (err: Error) => void = (err) => {}
  ) {
    // Create socket and attach handlers immediately to prevent unhandled errors
    const socketPath = getFullOsSocketPath();
    daemonLog('Creating socket:', socketPath);
    this.socket = connect(socketPath);
    daemonLog('Socket created, waiting for connection');
    this.socket.on('close', onClose);

    // Store the reject function so we can reject version check promise on socket errors
    let rejectVersionCheck: ((err: Error) => void) | undefined;

    this.socket.on('error', (err) => {
      daemonLog('Socket error:', err.message);
      // If we're still in version check phase, reject the promise so listen() throws
      if (rejectVersionCheck) {
        rejectVersionCheck(err);
        rejectVersionCheck = undefined;
      } else {
        // After version check is complete, call the onError callback
        onError(err);
      }
    });

    // Wait for the socket to actually connect before sending messages
    await new Promise<void>((resolve, reject) => {
      rejectVersionCheck = reject;
      this.socket!.once('connect', () => {
        daemonLog('Socket connected');
        resolve();
      });
    });

    // Version check handshake: Send VERSION_CHECK and wait for VERSION_CHECK_RESPONSE
    // before registering the real handler. If versions don't match, call onError.
    const { nxVersion } = require('../../utils/versions');
    daemonLog('Sending VERSION_CHECK, clientVersion:', nxVersion);
    await this.sendMessage({
      type: 'VERSION_CHECK',
      clientVersion: nxVersion,
    });
    daemonLog('VERSION_CHECK sent, waiting for response');

    const versionCheckPromise = new Promise<void>((resolve, reject) => {
      rejectVersionCheck = reject;

      const versionCheckHandler = consumeMessagesFromSocket(async (message) => {
        try {
          if (isJsonMessage(message)) {
            const parsed = JSON.parse(message);
            daemonLog('Received message type:', parsed.type);

            // Check for error response (old daemon doesn't understand VERSION_CHECK)
            if (parsed.error) {
              daemonLog('Received error from daemon:', parsed.error);

              if (
                parsed.error.includes('Invalid payload') ||
                parsed.error.includes('Unsupported payload')
              ) {
                this.socket!.removeListener('data', versionCheckHandler);
                this.socket!.removeListener('close', closeHandler);
                console.error(
                  `\n⚠️  Nx Daemon Version Mismatch\n` +
                    `   Client version: ${nxVersion}\n` +
                    `   Daemon version: older (doesn't support version check)\n` +
                    `   Please restart your command.\n`
                );
                this.close();
                reject(new VersionMismatchError());
                return;
              }
            }

            if (parsed.type === 'VERSION_CHECK_RESPONSE') {
              daemonLog(
                'VERSION_CHECK_RESPONSE received, serverVersion:',
                parsed.serverVersion
              );
              this.socket!.removeListener('data', versionCheckHandler);
              this.socket!.removeListener('close', closeHandler);

              if (parsed.serverVersion !== nxVersion) {
                daemonLog(
                  'Version mismatch! Server:',
                  parsed.serverVersion,
                  'Client:',
                  nxVersion
                );
                console.error(
                  `\n⚠️  Nx Daemon Version Mismatch\n` +
                    `   Client version: ${nxVersion}\n` +
                    `   Daemon version: ${parsed.serverVersion}\n` +
                    `   Please restart your command.\n`
                );
                this.close();
                reject(new VersionMismatchError());
                return;
              }

              daemonLog('Version check passed');
              resolve();
            }
          }
        } catch (e) {
          daemonLog('Error in version check handler:', e);
          resolve();
        }
      });

      // Handle socket closing during version check (old daemon shutting down)
      const closeHandler = () => {
        daemonLog(
          'Socket closed during version check - old daemon likely shut down'
        );
        this.socket!.removeListener('data', versionCheckHandler);
        console.error(
          `\n⚠️  Nx Daemon Version Mismatch\n` +
            `   Client version: ${nxVersion}\n` +
            `   Daemon version: older (doesn't support version check)\n` +
            `   Please restart your command.\n`
        );
        reject(new VersionMismatchError());
      };

      this.socket!.on('data', versionCheckHandler);
      this.socket!.once('close', closeHandler);
    });

    await versionCheckPromise;
    // Clear the reject function now that version check is complete
    rejectVersionCheck = undefined;
    daemonLog('Version check complete, registering data handler');

    // Register the real data handler
    this.socket.on(
      'data',
      consumeMessagesFromSocket(async (message) => {
        daemonLog('Received response message, length:', message.length);
        try {
          if (isJsonMessage(message)) {
            const parsed = JSON.parse(message);
            daemonLog('Received response type:', parsed.type);
          } else {
            daemonLog('Received binary (v8) response');
          }
        } catch (e) {
          daemonLog('Error parsing response for logging:', e.message);
        }
        onData(message);
      })
    );

    daemonLog('listen() complete');
    return this;
  }

  close() {
    if (this.socket) {
      this.socket.destroy();
    }
  }
}
