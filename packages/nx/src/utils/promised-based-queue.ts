export class PromisedBasedQueue {
  private counter = 0;
  private promise = Promise.resolve(null);

  private emptyCallback: () => void = null;

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
          this._promiseResolved();
        } catch (e) {
          rej(e);
          this._promiseResolved();
        }
      })
      .catch(async () => {
        try {
          res(await fn());
          this._promiseResolved();
        } catch (e) {
          rej(e);
          this._promiseResolved();
        }
      });
    return r;
  }

  isEmpty() {
    return this.counter === 0;
  }

  onQueueEmpty(callback: () => void): void {
    this.emptyCallback = callback;
  }

  private _promiseResolved() {
    this.counter--;
    if (this.isEmpty()) {
      this.emptyCallback();
    }
  }
}
