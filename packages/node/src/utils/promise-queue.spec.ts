import { PromiseQueue } from './promise-queue';

describe('PromiseQueue', () => {
  it('Should dequeue values as they are enqueued', async () => {
    const expectation = Symbol('value');
    const pQueue = new PromiseQueue();

    const result = await Promise.race([
      pQueue.dequeue(),
      new Promise(() => {
        pQueue.enqueue(expectation);
      }),
    ]);

    expect(result).toBe(expectation);
  });

  it('Should queue values in FIFO order', async () => {
    const first = Symbol('first');
    const second = Symbol('second');
    const third = Symbol('third');

    const pQueue = new PromiseQueue();

    pQueue.enqueue(first);
    pQueue.enqueue(second);
    pQueue.enqueue(third);

    expect(await pQueue.dequeue()).toEqual(first);
    expect(await pQueue.dequeue()).toEqual(second);
    expect(await pQueue.dequeue()).toEqual(third);
  });

  it('Should maintain size of the queue', async () => {
    const pQueue = new PromiseQueue();

    pQueue.enqueue(1);
    pQueue.enqueue(2);
    pQueue.enqueue(3);

    expect(pQueue.size).toBe(3);
    await pQueue.dequeue();
    expect(pQueue.size).toBe(2);
    await pQueue.dequeue();
    expect(pQueue.size).toBe(1);
    await pQueue.dequeue();
    expect(pQueue.size).toBe(0);
  });

  it('Should maintain size with out of order operations', async () => {
    const pQueue = new PromiseQueue();
    const values = [pQueue.dequeue(), pQueue.dequeue(), pQueue.dequeue()];
    const expectation = [1, 2, 3];

    expectation.forEach((x) => pQueue.enqueue(x));
    const result = await Promise.all(values);

    expect(result).toEqual([1, 1, 1]);
    expect(pQueue.size).toBe(2);
    expect(await pQueue.dequeue()).toBe(2);
    expect(pQueue.size).toBe(1);
    expect(await pQueue.dequeue()).toBe(3);
    expect(pQueue.size).toBe(0);
  });
});
