import { EventEmitter } from 'events';
import type { Socket } from 'net';
import { workspaceRoot } from '../../utils/workspace-root';
import { frameHeader } from '../../utils/consume-messages-from-socket';
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

describe('DaemonSocketMessenger framing failures', () => {
  const listenOn = () => {
    const socket = new EventEmitter() as unknown as Socket;
    (socket as any).write = () => true;
    const errors: Error[] = [];
    const messages: Buffer[] = [];
    new DaemonSocketMessenger(socket).listen(
      (m) => messages.push(m),
      () => {},
      (err) => errors.push(err)
    );
    return { socket, errors, messages };
  };

  it('reports a desynchronized stream to onError', () => {
    // Without this the socket stays open and writable, nothing settles the
    // in-flight request, and the CLI waits out the keep-alive timeout before
    // reporting a handler timeout that points away from the real cause.
    const { socket, errors, messages } = listenOn();

    socket.emit('data', Buffer.from('not a framed message', 'utf8'));

    expect(messages).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('out of sync');
  });

  it('does not report an error for a healthy stream', () => {
    const { socket, errors, messages } = listenOn();
    const payload = Buffer.from('{"ok":true}', 'utf8');

    socket.emit('data', Buffer.concat([frameHeader(payload.length), payload]));

    expect(errors).toEqual([]);
    expect(messages).toHaveLength(1);
  });
});
