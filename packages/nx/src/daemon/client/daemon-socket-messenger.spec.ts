import type { Socket } from 'net';
import { workspaceRoot } from '../../utils/workspace-root';
import { MESSAGE_HEADER_PREFIX } from '../../utils/consume-messages-from-socket';
import { DaemonSocketMessenger } from './daemon-socket-messenger';

describe('DaemonSocketMessenger', () => {
  const send = (force?: 'v8' | 'json') => {
    const writes: Buffer[] = [];
    const socket = {
      write: (data: Buffer) => writes.push(data),
    } as unknown as Socket;

    new DaemonSocketMessenger(socket).sendMessage({ type: 'PING' }, force);
    return writes;
  };

  it('should stamp the workspace root on outgoing messages', () => {
    const [, payload] = send('json');

    expect(JSON.parse(payload.toString('utf8')).workspaceRoot).toBe(
      workspaceRoot
    );
  });

  it('writes a length header ahead of the payload', () => {
    const [header, payload] = send('json');

    expect(header.toString('ascii')).toBe(
      `${MESSAGE_HEADER_PREFIX}${payload.length}:`
    );
  });

  it('writes the payload as bytes rather than a string', () => {
    // A large v8 payload must reach the socket without being converted to a
    // string first — that conversion is what caps a message at ~512MB.
    const [, payload] = send('v8');

    expect(Buffer.isBuffer(payload)).toBe(true);
    expect(payload[0]).toBe(0xff);
  });
});
