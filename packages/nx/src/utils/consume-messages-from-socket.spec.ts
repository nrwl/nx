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
  DEFAULT_MAX_MESSAGE_SIZE,
  describeMessage,
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

  it('holds a partial message indefinitely rather than timing out', () => {
    vi.useFakeTimers();
    try {
      const { messages, errors, feed } = collect();
      const wire = json({ one: 1 });
      feed(wire.subarray(0, wire.length - 2));

      // An idle timer here could only fire from the timers phase, which runs
      // before poll: a reader blocked in its own data handler would have the
      // deadline pass before the bytes it is waiting on are delivered, and the
      // stream would be killed while the peer was healthy.
      vi.advanceTimersByTime(10 * 60_000);
      expect(errors).toEqual([]);

      feed(wire.subarray(wire.length - 2));
      expect(messages).toEqual([{ one: 1 }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves no timer holding the event loop open', () => {
    vi.useFakeTimers();
    try {
      const { feed } = collect();
      feed(json({ one: 1 }).subarray(0, 6));

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a zero-length frame instead of delivering an empty message', () => {
    const { messages, errors, feed } = collect();
    feed(Buffer.from(`${MESSAGE_HEADER_PREFIX}0:`, 'ascii'));

    expect(messages).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('zero-length');
  });

  it('stops consuming once the stream is broken', () => {
    const { messages, errors, feed } = collect();
    feed(Buffer.from('garbage', 'utf8'));
    feed(json({ one: 1 }));
    expect(messages).toEqual([]);
    expect(errors).toHaveLength(1);
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

describe('the message size limit', () => {
  const withEnv = (value: string | undefined, fn: () => void) => {
    const previous = process.env.NX_MAX_MESSAGE_SIZE;
    if (value === undefined) delete process.env.NX_MAX_MESSAGE_SIZE;
    else process.env.NX_MAX_MESSAGE_SIZE = value;
    try {
      fn();
    } finally {
      if (previous === undefined) delete process.env.NX_MAX_MESSAGE_SIZE;
      else process.env.NX_MAX_MESSAGE_SIZE = previous;
    }
  };

  const feedHeaderFor = (bytes: number) => {
    const errors: Error[] = [];
    const messages: Buffer[] = [];
    const feed = consumeMessagesFromSocket(
      (m) => messages.push(m),
      (e) => errors.push(e)
    );
    // The header alone is enough: the limit is enforced before the payload is
    // buffered, so an oversized message never gets to allocate.
    feed(Buffer.from(`${MESSAGE_HEADER_PREFIX}${bytes}:`, 'ascii'));
    return { errors, messages };
  };

  it('rejects a declared length above the limit before buffering it', () => {
    const { errors } = withEnvReturn('1024', () => feedHeaderFor(1025));

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('exceeds the 1024 byte limit');
    expect(errors[0].message).toContain('NX_MAX_MESSAGE_SIZE');
  });

  it('accepts a declared length at the limit', () => {
    const { errors } = withEnvReturn('1024', () => feedHeaderFor(1024));

    expect(errors).toEqual([]);
  });

  it('removes the ceiling when set to 0', () => {
    const { errors } = withEnvReturn('0', () =>
      feedHeaderFor(DEFAULT_MAX_MESSAGE_SIZE + 1)
    );

    expect(errors).toEqual([]);
  });

  it('defaults to a ceiling above the string limit it replaced', () => {
    // Anything that previously worked was capped at MAX_STRING_LENGTH, so the
    // default has to clear that comfortably or this PR regresses the payloads
    // it exists to support.
    expect(DEFAULT_MAX_MESSAGE_SIZE).toBeGreaterThan(536_870_888);
  });

  it('falls back to the default when the value is not a byte count', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { errors } = withEnvReturn('lots', () =>
      feedHeaderFor(DEFAULT_MAX_MESSAGE_SIZE + 1)
    );

    expect(errors).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('NX_MAX_MESSAGE_SIZE')
    );
  });

  function withEnvReturn<T>(value: string | undefined, fn: () => T): T {
    let out!: T;
    withEnv(value, () => {
      out = fn();
    });
    return out;
  }
});

describe('describeMessage', () => {
  it('shows a JSON payload as text', () => {
    const described = describeMessage(Buffer.from('{"a":1}', 'utf8'));

    expect(described).toContain('json, 7 bytes');
    expect(described).toContain('{"a":1}');
  });

  it('shows a v8 payload as hex rather than mangling it through utf8', () => {
    // Decoding v8 bytes as utf8 replaces everything above 0x7f with U+FFFD,
    // starting with the 0xFF header, so the excerpt loses the one byte that
    // identifies the format.
    const described = describeMessage(v8Serialize({ a: 1 }));

    expect(described).toContain('v8,');
    expect(described).toContain('ff0f');
    expect(described).not.toContain('\ufffd');
  });

  it('reports how much of a truncated message is shown', () => {
    const message = Buffer.from('x'.repeat(1000), 'utf8');

    expect(describeMessage(message, { maxBytes: 10 })).toContain(
      '1000 bytes, first 10 shown'
    );
    expect(describeMessage(message, { maxBytes: 10, from: 'end' })).toContain(
      '1000 bytes, last 10 shown'
    );
  });

  it('does not claim truncation when the whole message fits', () => {
    expect(
      describeMessage(Buffer.from('{}', 'utf8'), { maxBytes: 300 })
    ).not.toContain('shown');
  });

  it.each(['start', 'end'] as const)(
    'never splits a utf8 character when truncating from the %s',
    (from) => {
      // Every cut offset, because a single hand-picked maxBytes lands on a
      // character boundary by luck as often as not.
      const message = Buffer.from(
        JSON.stringify({ path: '/src/日本語テスト.ts', tag: 'unicode' }),
        'utf8'
      );

      for (let maxBytes = 1; maxBytes <= message.length; maxBytes++) {
        expect({
          maxBytes,
          described: describeMessage(message, { maxBytes, from }),
        }).toEqual({
          maxBytes,
          described: expect.not.stringContaining('\ufffd'),
        });
      }
    }
  );

  it('keeps the excerpt a substring of the original', () => {
    const payload = JSON.stringify({ path: '/src/日本語テスト.ts' });
    const message = Buffer.from(payload, 'utf8');

    for (let maxBytes = 1; maxBytes <= message.length; maxBytes++) {
      const body = describeMessage(message, { maxBytes, from: 'end' })
        .split('\n')
        .slice(1)
        .join('\n');
      expect(payload.endsWith(body)).toBe(true);
    }
  });

  it('takes the requested end of the message', () => {
    const message = Buffer.from('STARTmiddleEND', 'utf8');

    expect(describeMessage(message, { maxBytes: 3, from: 'end' })).toContain(
      'END'
    );
    expect(describeMessage(message, { maxBytes: 5 })).toContain('START');
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
