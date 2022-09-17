import { consumeMessagesFromSocket } from 'nx/src/utils/consume-messages-from-socket';

describe('consumeMessagesFromSocket', () => {
  it('should handle messages where every messages is in its own chunk', async () => {
    const messages = [] as any[];
    const r = consumeMessagesFromSocket(async (message) =>
      messages.push(JSON.parse(message))
    );
    await r(JSON.stringify({ one: 1 }) + String.fromCodePoint(4));
    await r(JSON.stringify({ two: 2 }) + String.fromCodePoint(4));
    expect(messages).toEqual([{ one: 1 }, { two: 2 }]);
  });

  it('should handle messages with a message spanning multiple chunks ', async () => {
    const messages = [] as any[];
    const r = consumeMessagesFromSocket(async (message) =>
      messages.push(JSON.parse(message))
    );
    const message = JSON.stringify({ one: 1 });
    await r(message.substring(0, 3));
    await r(message.substring(3) + String.fromCodePoint(4));
    expect(messages).toEqual([{ one: 1 }]);
  });

  it('should handle messages where multiple messages are in the same chunk', async () => {
    const messages = [] as any[];
    const r = consumeMessagesFromSocket(async (message) =>
      messages.push(JSON.parse(message))
    );
    const message1 = JSON.stringify({ one: 1 });
    const message2 = JSON.stringify({ two: 2 });
    const message3 = JSON.stringify({ three: 3 });

    await r(message1.substring(0, 3));
    await r(
      message1.substring(3) +
        String.fromCodePoint(4) +
        message2 +
        String.fromCodePoint(4) +
        message3.substring(0, 3)
    );
    await r(message3.substring(3) + String.fromCodePoint(4));

    expect(messages).toEqual([{ one: 1 }, { two: 2 }, { three: 3 }]);
  });
});
