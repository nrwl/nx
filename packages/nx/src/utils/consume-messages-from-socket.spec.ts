import { randomBytes } from 'crypto';
import { createServer, connect, Server, Socket } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { serialize as v8Serialize } from 'v8';
import { serialize } from '../daemon/socket-utils';
import {
  consumeMessagesFromSocket,
  frameHeader,
  isJsonMessage,
  MESSAGE_HEADER_PREFIX,
  parseMessage,
  writeMessage,
} from './consume-messages-from-socket';

const frame = (payload: Buffer | string): Buffer => {
  const body = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(payload, 'utf8');
  return Buffer.concat([frameHeader(body.length), body]);
};

const json = (value: unknown) => frame(JSON.stringify(value));

describe('consumeMessagesFromSocket', () => {
  const collect = () => {
    const messages: any[] = [];
    const errors: Error[] = [];
    const feed = consumeMessagesFromSocket(
      (message) => messages.push(parseMessage(message)),
      (error) => errors.push(error)
    );
    return { messages, errors, feed };
  };

  it('handles each message arriving in its own chunk', () => {
    const { messages, feed } = collect();
    feed(json({ one: 1 }));
    feed(json({ two: 2 }));
    expect(messages).toEqual([{ one: 1 }, { two: 2 }]);
  });

  it('handles a message spanning multiple chunks', () => {
    const { messages, feed } = collect();
    const wire = json({ one: 1 });
    feed(wire.subarray(0, 3));
    feed(wire.subarray(3, 9));
    feed(wire.subarray(9));
    expect(messages).toEqual([{ one: 1 }]);
  });

  it('handles a header split across chunks', () => {
    const { messages, feed } = collect();
    const wire = json({ one: 1 });
    // Split inside "NX_MSG_<len>:" itself.
    feed(wire.subarray(0, 4));
    feed(wire.subarray(4));
    expect(messages).toEqual([{ one: 1 }]);
  });

  it('handles multiple messages in the same chunk', () => {
    const { messages, feed } = collect();
    const third = json({ three: 3 });
    feed(
      Buffer.concat([json({ one: 1 }), json({ two: 2 }), third.subarray(0, 4)])
    );
    feed(third.subarray(4));
    expect(messages).toEqual([{ one: 1 }, { two: 2 }, { three: 3 }]);
  });

  it('delivers a completed message that shares a chunk with an incomplete one', () => {
    const { messages, feed } = collect();
    const second = json({ two: 2 });
    feed(Buffer.concat([json({ one: 1 }), second.subarray(0, 5)]));

    // The trailer protocol held this back until a chunk happened to end on a
    // message boundary; length framing releases it immediately.
    expect(messages).toEqual([{ one: 1 }]);
  });

  it('handles multibyte UTF-8 characters split across chunks', () => {
    const { messages, feed } = collect();
    const wire = json({ path: '/test/한글테스트.tsx' });
    const mid = Math.floor(wire.length / 2);
    feed(wire.subarray(0, mid));
    feed(wire.subarray(mid));
    expect(messages).toEqual([{ path: '/test/한글테스트.tsx' }]);
  });

  it('carries a v8 payload whose bytes contain the header prefix', () => {
    const { messages, errors, feed } = collect();
    // A payload that embeds the framing marker must not desynchronize the
    // stream — the length prefix, not a scan, decides where it ends.
    const payload = { path: `libs/${MESSAGE_HEADER_PREFIX}42:/src/index.ts` };
    const wire = frame(v8Serialize(payload));
    feed(wire.subarray(0, 12));
    feed(wire.subarray(12));
    expect(errors).toEqual([]);
    expect(messages).toEqual([payload]);
  });

  it('round-trips a payload larger than a single chunk', () => {
    const { messages, feed } = collect();
    const payload = { blob: 'x'.repeat(500_000) };
    const wire = frame(v8Serialize(payload));
    for (let i = 0; i < wire.length; i += 64_000) {
      feed(wire.subarray(i, i + 64_000));
    }
    expect(messages).toEqual([payload]);
  });

  it('reports a desynchronized stream instead of hanging', () => {
    const { messages, errors, feed } = collect();
    feed(Buffer.from('this is not a framed message', 'utf8'));
    expect(messages).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('out of sync');
  });

  it('rejects a header with a non-numeric length', () => {
    const { errors, feed } = collect();
    feed(Buffer.from(`${MESSAGE_HEADER_PREFIX}12a4:{}`, 'utf8'));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('non-digit');
  });

  it('stops consuming once the stream is broken', () => {
    const { messages, errors, feed } = collect();
    feed(Buffer.from('garbage', 'utf8'));
    feed(json({ one: 1 }));
    expect(messages).toEqual([]);
    expect(errors).toHaveLength(1);
  });

  it('times out a message that never completes', () => {
    vi.useFakeTimers();
    try {
      const { messages, errors, feed } = collect();
      const wire = json({ one: 1 });
      feed(wire.subarray(0, wire.length - 2));

      expect(errors).toEqual([]);
      vi.advanceTimersByTime(60_000);

      expect(messages).toEqual([]);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Timed out');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not time out while chunks keep arriving', () => {
    vi.useFakeTimers();
    try {
      const { messages, errors, feed } = collect();
      const wire = json({ one: 1 });
      feed(wire.subarray(0, 5));
      vi.advanceTimersByTime(45_000);
      feed(wire.subarray(5, 9));
      vi.advanceTimersByTime(45_000);
      feed(wire.subarray(9));

      expect(errors).toEqual([]);
      expect(messages).toEqual([{ one: 1 }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops the timer once every buffered message is delivered', () => {
    vi.useFakeTimers();
    try {
      const { errors, feed } = collect();
      feed(json({ one: 1 }));
      vi.advanceTimersByTime(120_000);
      expect(errors).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('isJsonMessage', () => {
  it.each([
    ['{}', true],
    ['{"a":1}', true],
    ['[1,2]', true],
    ['"hello"', true],
    ['true', true],
    ['42', true],
  ])('treats %j as JSON', (message, expected) => {
    expect(isJsonMessage(Buffer.from(message as string, 'utf8'))).toBe(
      expected
    );
  });

  it.each([[{ a: 1 }], [[1, 2, 3]], [new Date()], [42], ['hello'], [true]])(
    'treats the v8 encoding of %j as non-JSON',
    (value) => {
      // Byte-level detection also covers bare v8 primitives, which the previous
      // string-prefix check could not distinguish from their JSON spelling.
      expect(isJsonMessage(v8Serialize(value))).toBe(false);
    }
  );
});

describe('parseMessage', () => {
  it('parses a JSON-serialized payload', () => {
    const payload = { type: 'HELLO', nested: { n: 1 } };
    expect(parseMessage(Buffer.from(JSON.stringify(payload), 'utf8'))).toEqual(
      payload
    );
  });

  it('round-trips v8-only types that JSON cannot represent', () => {
    const date = new Date('2024-01-02T03:04:05.678Z');
    const parsed = parseMessage<{ when: Date; buf: Buffer; big: bigint }>(
      v8Serialize({ when: date, buf: Buffer.from([1, 2, 3]), big: 7n })
    );
    expect(parsed.when.toISOString()).toBe(date.toISOString());
    expect(Array.from(parsed.buf)).toEqual([1, 2, 3]);
    expect(parsed.big).toBe(7n);
  });
});

describe('framing over a real socket', () => {
  const servers: Server[] = [];
  const clients: Socket[] = [];

  afterEach(() => {
    for (const socket of clients.splice(0)) socket.destroy();
    for (const server of servers.splice(0)) server.close();
  });

  // Exercises writeMessage and consumeMessagesFromSocket against each other
  // through the kernel, where chunk boundaries are chosen by the OS rather
  // than by the test.
  const roundTrip = (payloads: unknown[]): Promise<unknown[]> =>
    new Promise((resolve, reject) => {
      const socketPath = join(
        tmpdir(),
        `nx-framing-${randomBytes(6).toString('hex')}.sock`
      );
      const received: unknown[] = [];

      const server = createServer((connection) => {
        connection.on(
          'data',
          consumeMessagesFromSocket((message) => {
            received.push(parseMessage(message));
            if (received.length === payloads.length) resolve(received);
          }, reject)
        );
      });
      servers.push(server);

      server.listen(socketPath, () => {
        const client = connect(socketPath, () => {
          for (const payload of payloads) {
            writeMessage(client, serialize(payload));
          }
        });
        client.on('error', reject);
        clients.push(client);
      });
      server.on('error', reject);
    });

  it('round-trips several small messages written back to back', async () => {
    const payloads = [{ type: 'PING' }, { type: 'HASH_TASKS' }, { n: 3 }];
    await expect(roundTrip(payloads)).resolves.toEqual(payloads);
  });

  it('round-trips a payload far larger than one TCP segment', async () => {
    const payload = {
      type: 'HASH_TASKS',
      nodes: Object.fromEntries(
        Array.from({ length: 60_000 }, (_, i) => [
          `libs/team-${i % 400}/src/lib/component-${i}.ts`,
          `hash-${i}`,
        ])
      ),
    };
    const [received] = await roundTrip([payload]);
    expect(received).toEqual(payload);
  });

  it('round-trips a v8-only payload the JSON path could not carry', async () => {
    const payload = {
      when: new Date('2024-05-06T07:08:09.010Z'),
      big: 2n ** 70n,
    };
    const [received] = await roundTrip([payload]);
    expect(received).toEqual(payload);
  });
});
