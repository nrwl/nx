import { useEffect, useRef } from 'react';

export const useIntervalWhen = (
  callback: () => void,
  delay: number,
  condition: boolean
) => {
  const savedCallback = useRef(() => {});

  useEffect(() => {
    if (condition) {
      savedCallback.current = callback;
    }
  }, [callback, condition]);

  useEffect(() => {
    if (condition) {
      const tick = () => {
        savedCallback.current();
      };

      if (delay !== null) {
        let id = setInterval(tick, delay);
        return () => clearInterval(id);
      }
    }
  }, [delay, condition]);
};
