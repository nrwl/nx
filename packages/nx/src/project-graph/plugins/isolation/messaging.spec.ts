import type { Socket } from 'net';
import { workspaceRoot } from '../../../utils/workspace-root';
import { sendMessageOverSocket } from './messaging';

describe('sendMessageOverSocket', () => {
  // The receiver treats an unstamped message as "not foreign", so dropping this
  // stamp disables cross-workspace rejection on the plugin-worker channel
  // without throwing, logging or degrading. Mutation testing found it was the
  // one guard in this PR that nothing observed.
  //
  // Asserted on the message object rather than the bytes: `serialize` is v8 or
  // JSON depending on configuration, and the wire format is not the contract —
  // the receiver reads `msg.workspaceRoot` off the deserialized object.
  it('should stamp the workspace root on outgoing messages', () => {
    const socket = { write: () => {} } as unknown as Socket;
    const message = { type: 'ping' } as any;

    sendMessageOverSocket(socket, message);

    expect(message.workspaceRoot).toBe(workspaceRoot);
  });
});
