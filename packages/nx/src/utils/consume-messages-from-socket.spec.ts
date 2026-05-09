import { serialize as v8Serialize } from 'v8';
import {
  consumeMessagesFromSocket,
  isJsonMessage,
  MESSAGE_END_SEQ,
  parseMessage,
} from './consume-messages-from-socket';

describe('consumeMessagesFromSocket', () => {
  it('should handle messages where every messages is in its own chunk', () => {
    const messages = [] as any[];
    const r = consumeMessagesFromSocket((message) =>
      messages.push(JSON.parse(message))
    );
    r(JSON.stringify({ one: 1 }) + MESSAGE_END_SEQ);
    r(JSON.stringify({ two: 2 }) + MESSAGE_END_SEQ);
    expect(messages).toEqual([{ one: 1 }, { two: 2 }]);
  });

  it('should handle messages with a message spanning multiple chunks ', () => {
    const messages = [] as any[];
    const r = consumeMessagesFromSocket((message) =>
      messages.push(JSON.parse(message))
    );
    const message = JSON.stringify({ one: 1 });
    r(message.substring(0, 3));
    r(message.substring(3) + MESSAGE_END_SEQ);
    expect(messages).toEqual([{ one: 1 }]);
  });

  it('should handle messages where multiple messages are in the same chunk', () => {
    const messages = [] as any[];
    const r = consumeMessagesFromSocket((message) =>
      messages.push(JSON.parse(message))
    );
    const message1 = JSON.stringify({ one: 1 });
    const message2 = JSON.stringify({ two: 2 });
    const message3 = JSON.stringify({ three: 3 });

    r(message1.substring(0, 3));
    r(
      message1.substring(3) +
        MESSAGE_END_SEQ +
        message2 +
        MESSAGE_END_SEQ +
        message3.substring(0, 3)
    );
    r(message3.substring(3) + MESSAGE_END_SEQ);

    expect(messages).toEqual([{ one: 1 }, { two: 2 }, { three: 3 }]);
  });

  it('should handle multibyte UTF-8 characters split across chunks', () => {
    const messages = [] as any[];
    const r = consumeMessagesFromSocket((message) =>
      messages.push(JSON.parse(message))
    );

    // "한글테스트" path included in JSON
    const json = JSON.stringify({ path: '/test/한글테스트.tsx' });
    const buffer = Buffer.from(json + MESSAGE_END_SEQ, 'utf8');

    // Split in the middle of a multibyte character
    const mid = Math.floor(buffer.length / 2);
    r(buffer.subarray(0, mid));
    r(buffer.subarray(mid));

    expect(messages).toEqual([{ path: '/test/한글테스트.tsx' }]);
  });
});

describe('isJsonMessage', () => {
  it.each([
    ['{}', true],
    ['{"a":1}', true],
    ['[]', true],
    ['[1,2]', true],
    ['"hello"', true],
    ['true', true],
    ['false', true],
    ['42', true],
    ['3.14', true],
    // v8-serialized buffers start with 0xFF, which is none of the JSON prefixes
    [v8Serialize({ a: 1 }).toString('binary'), false],
    [v8Serialize([1, 2, 3]).toString('binary'), false],
    [v8Serialize(new Date()).toString('binary'), false],
  ])('returns correct value for %j', (message, expected) => {
    expect(isJsonMessage(message)).toBe(expected);
  });
});

describe('parseMessage', () => {
  it('parses a JSON-serialized payload', () => {
    const payload = { type: 'HELLO', nested: { n: 1 } };
    expect(parseMessage(JSON.stringify(payload))).toEqual(payload);
  });

  it('parses a v8-serialized payload', () => {
    const payload = { type: 'HELLO', nested: { n: 1 } };
    const wire = v8Serialize(payload).toString('binary');
    expect(parseMessage(wire)).toEqual(payload);
  });

  it('round-trips v8-only types that JSON cannot represent', () => {
    const date = new Date('2024-01-02T03:04:05.678Z');
    const wire = v8Serialize({
      when: date,
      buf: Buffer.from([1, 2, 3]),
    }).toString('binary');

    const parsed = parseMessage<{ when: Date; buf: Buffer }>(wire);
    expect(parsed.when.toISOString()).toBe(date.toISOString());
    expect(Buffer.isBuffer(parsed.buf)).toBe(true);
    expect(Array.from(parsed.buf)).toEqual([1, 2, 3]);
  });

  it('round-trips v8-serialized arrays and primitives', () => {
    expect(parseMessage(v8Serialize([1, 2, 3]).toString('binary'))).toEqual([
      1, 2, 3,
    ]);
    // Bare v8 primitives (number/boolean/string) are indistinguishable from
    // JSON by isJsonMessage, so parseMessage is only guaranteed to round-trip
    // objects/arrays/Buffers/Dates — the cases used by daemon/pseudo-IPC.
  });
});
