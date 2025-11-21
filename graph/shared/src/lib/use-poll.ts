import { useEffect, useRef } from 'react';

export const usePoll = (
  callback: () => Promise<void>,
  delay: number,
  condition: boolean
) => {
  const savedCallback = useRef(() => Promise.resolve());

  useEffect(() => {
    if (condition) {
      savedCallback.current = callback;
    }
  }, [callback, condition]);

  useEffect(() => {
    if (!condition) {
      return;
    }
    let timeoutId: NodeJS.Timeout;

    async function callTickAfterDelay() {
      await savedCallback.current();
      if (delay !== null) {
        timeoutId = setTimeout(callTickAfterDelay, delay);
      }
    }

    callTickAfterDelay();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [delay, condition]);
};
