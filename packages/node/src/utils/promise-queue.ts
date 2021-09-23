interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (err?: unknown) => void;
}

interface Node<T> {
  value: T;
  tail: Promise<Node<T>>;
}

const createDeferred = <T>(): Deferred<T> => {
  const deferred = {
    promise: Promise.resolve<T>(null as any),
    resolve: (_value: T) => {},
    reject: (_reason?: unknown) => {},
  };

  deferred.promise = new Promise<T>((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  return deferred;
};

export class PromiseQueue<T> {
  private head = createDeferred<Node<T>>();
  private promises = new Set<Promise<unknown>>();

  get size() {
    return this.promises.size;
  }

  enqueue(value) {
    const next = createDeferred<Node<T>>();

    this.promises.add(next.promise);

    this.head.resolve({
      value,
      tail: next.promise,
    });

    this.head.resolve = next.resolve;
  }

  async dequeue() {
    const { value, tail } = await this.head.promise;

    this.head.promise = tail;
    this.promises.delete(tail);

    return value;
  }
}
