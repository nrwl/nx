export class PromisedBasedQueue<T = any> {
  private counter = 0;
  private promise: Promise<void> | undefined;

  sendToQueue(fn: () => Promise<T>): Promise<T> {
    this.counter++;
    let res: (value: T) => void, rej: (err: unknown) => void;
    const r = new Promise<T>((_res, _rej) => {
      res = _res;
      rej = _rej;
    });

    this.promise = (this.promise ? this.promise : Promise.resolve())
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
}
