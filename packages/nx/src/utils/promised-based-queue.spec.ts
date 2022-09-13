import { PromisedBasedQueue } from './promised-based-queue';

describe('PromisedBasedQueue', () => {
  it('should executing functions in order', async () => {
    const queue = new PromisedBasedQueue();
    const log = [];
    const res = [];
    res.push(
      await queue.sendToQueue(async () => {
        log.push('1');
        await wait(100);
        log.push('2');
        return 100;
      })
    );
    res.push(
      await queue.sendToQueue(async () => {
        log.push('3');
        return 200;
      })
    );

    expect(log).toEqual(['1', '2', '3']);
    expect(res).toEqual([100, 200]);
  });

  it('should handle errors', async () => {
    const queue = new PromisedBasedQueue();
    try {
      await queue.sendToQueue(async () => {
        throw new Error('1');
      });
      expect('fail').toBeTruthy();
    } catch (e) {
      expect(e.message).toEqual('1');
    }
    expect(
      await queue.sendToQueue(async () => {
        return 100;
      })
    ).toEqual(100);
  });
});

function wait(millis: number) {
  return new Promise((res) => {
    setTimeout(() => res(null), millis);
  });
}
