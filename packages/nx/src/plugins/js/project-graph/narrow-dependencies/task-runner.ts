export class TaskRunner {
  constructor(private readonly concurrency: number) {}

  async map<T, R>(
    items: readonly T[],
    fn: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }

    const results = new Array<R>(items.length);
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= items.length) {
          return;
        }

        results[index] = await fn(items[index], index);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(this.concurrency, items.length) }, () =>
        worker()
      )
    );

    return results;
  }
}