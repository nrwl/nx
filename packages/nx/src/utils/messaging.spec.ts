import {
  consumeMessagesFromSocket,
  PendingPromise,
  registerPendingPromise,
} from './messaging';

describe('consumeMessagesFromSocket', () => {
  it('should handle messages where every messages is in its own chunk', () => {
    const messages = [] as any[];
    const r = consumeMessagesFromSocket((message) =>
      messages.push(JSON.parse(message))
    );
    r(JSON.stringify({ one: 1 }) + String.fromCodePoint(4));
    r(JSON.stringify({ two: 2 }) + String.fromCodePoint(4));
    expect(messages).toEqual([{ one: 1 }, { two: 2 }]);
  });

  it('should handle messages with a message spanning multiple chunks ', () => {
    const messages = [] as any[];
    const r = consumeMessagesFromSocket((message) =>
      messages.push(JSON.parse(message))
    );
    const message = JSON.stringify({ one: 1 });
    r(message.substring(0, 3));
    r(message.substring(3) + String.fromCodePoint(4));
    expect(messages).toEqual([{ one: 1 }]);
  });

  // it('should handle messages where multiple messages are in the same chunk', () => {
  //   const messages = [] as any[];
  //   const r = consumeMessagesFromSocket((message) =>
  //     messages.push(JSON.parse(message))
  //   );
  //   const message1 = JSON.stringify({ one: 1 });
  //   const message2 = JSON.stringify({ two: 2 });
  //   const message3 = JSON.stringify({ three: 3 });
  //
  //   r(message1.substring(0, 3));
  //   r(
  //     message1.substring(3) +
  //       String.fromCodePoint(4) +
  //       message2 +
  //       String.fromCodePoint(4) +
  //       message3.substring(0, 3)
  //   );
  //   r(message3.substring(3) + String.fromCodePoint(4));
  //
  //   expect(messages).toEqual([{ one: 1 }, { two: 2 }, { three: 3 }]);
  // });
});

describe('registerPendingPromise', () => {
  it('should store a pending promise', async () => {
    const pending = new Map<string, PendingPromise>();
    const p = registerPendingPromise('1', pending, jest.fn(), () => 'foo', 25);
    setTimeout(() => pending.get('1')!.resolver('bar'), 15);
    expect(await p).toEqual('bar');
    expect(pending.size).toBe(0);
  });

  it('should reject the promise if the callback takes too long', async () => {
    const pending = new Map<string, PendingPromise>();
    const p = registerPendingPromise('1', pending, jest.fn(), () => 'foo', 10);
    await expect(p).rejects.toThrow('foo');
    expect(pending.size).toBe(0);
  });

  it('should call the callback', async () => {
    const pending = new Map<string, PendingPromise>();
    const callback = jest.fn();
    registerPendingPromise('1', pending, callback, () => 'foo', 10);
    pending.get('1')!.resolver('bar');
    expect(callback).toHaveBeenCalled();
  });
});
