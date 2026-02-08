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
}
