export class PromisedBasedQueue {
  private counter = 0;
  private promise = Promise.resolve(null);

  sendToQueue(fn: () => Promise<any>): Promise<any> {
    this.counter++;
    let res, rej;
    const r = new Promise((_res, _rej) => {
      res = _res;
      rej = _rej;
    });

    this.promise = this.promise
      .then(async () => {
        try {
          res(await fn());
          this.counter--;
        } catch (e) {
          rej(e);
          this.counter--;
        }
      })
      .catch(async () => {
        try {
          res(await fn());
          this.counter--;
        } catch (e) {
          rej(e);
          this.counter--;
        }
      });
    return r;
  }

  isEmpty() {
    return this.counter === 0;
  }

  /**
   * Used to decrement the internal counter representing the number of active promises in the queue.
   * This is useful for retrying a failed daemon message, as we want to be able to shut the daemon down
   * without marking the promise that represents the failed message as settled. To do so, we store
   * the promise in a separate variable and only resolve or reject it later.
   */
  decrementQueueCounter() {
    this.counter--;
  }
}
