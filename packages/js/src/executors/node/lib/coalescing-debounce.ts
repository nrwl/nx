export function createCoalescingDebounce<T>(
  fn: () => Promise<T>,
  wait: number
): { trigger: () => Promise<T>; cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;
  let activePromise: Promise<T> | null = null;
  let nextPromiseResolvers: Array<{
    resolve: (value: T) => void;
    reject: (error: any) => void;
  }> = [];

  return {
    trigger: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (activePromise) {
        return new Promise<T>((resolve, reject) => {
          nextPromiseResolvers.push({ resolve, reject });
        });
      }

      return new Promise<T>((resolve, reject) => {
        nextPromiseResolvers.push({ resolve, reject });

        timeoutId = setTimeout(async () => {
          activePromise = fn();
          try {
            const result = await activePromise;
            for (const { resolve } of nextPromiseResolvers) {
              resolve(result);
            }
          } catch (error) {
            for (const { reject } of nextPromiseResolvers) {
              reject(error);
            }
          } finally {
            activePromise = null;
            nextPromiseResolvers = [];
          }
        }, wait);
      });
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      for (const { reject } of nextPromiseResolvers) {
        reject(new Error('Cancelled'));
      }
      nextPromiseResolvers = [];
    },
  };
}
