import type { Socket } from 'net';
import { workspaceRoot } from '../../utils/workspace-root';
import { DaemonSocketMessenger } from './daemon-socket-messenger';

describe('DaemonSocketMessenger', () => {
  it('should stamp the workspace root on outgoing messages', () => {
    const writes: string[] = [];
    const socket = {
      write: (data: string) => writes.push(data),
    } as unknown as Socket;

    new DaemonSocketMessenger(socket).sendMessage({ type: 'PING' }, 'json');

    // The first write is the serialized message; the second is the frame
    // terminator.
    const sent = JSON.parse(writes[0]);
    expect(sent.workspaceRoot).toBe(workspaceRoot);
  });
});
