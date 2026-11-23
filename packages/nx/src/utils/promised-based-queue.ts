export class PromisedBasedQueue {
  private counter = 0;
  private promise: Promise<void> = Promise.resolve();

  sendToQueue(fn: () => Promise<any>): Promise<any> {
    this.counter++;
    return new Promise((res, rej) => {
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
    });
  }

  isEmpty() {
    return this.counter === 0;
  }
}
