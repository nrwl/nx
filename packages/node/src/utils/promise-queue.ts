interface Deferred<T> {
  promise: Promise<T>,
  resolve: (value: T|PromiseLike<T>) => void,
  reject: (err?: unknown) => void
}

interface Node<T> {
  value: T,
  tail: Deferred<Node<T>>
}

const createDeferred = <T>(): Deferred<T> => {
  const deferred = {
    promise: Promise.resolve<T>(null as any),
    resolve: (value: T) => {},
    reject: (reason?: unknown) => {}
  };

  deferred.promise = new Promise<T>((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  return deferred;
};



export class PromiseQueue<T> {
  private head = createDeferred<Node<T>>();

  enqueue(value){
    const next = createDeferred<Node<T>>();

    this.head.resolve({
      value,
      tail: next
    });
  }

  async dequeue() {
    const { value, tail } = await this.head.promise;

    this.head = tail;

    return value;
  }
}
