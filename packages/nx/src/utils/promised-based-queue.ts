export class PromisedBasedQueue {
  private promise = Promise.resolve(null);

  sendToQueue(fn: () => Promise<any>): Promise<any> {
    let res, rej;
    const r = new Promise((_res, _rej) => {
      res = _res;
      rej = _rej;
    });

    this.promise = this.promise
      .then(async () => {
        try {
          res(await fn());
        } catch (e) {
          rej(e);
        }
      })
      .catch(async () => {
        try {
          res(await fn());
        } catch (e) {
          rej(e);
        }
      });
    return r;
  }
}
