import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';

export function useDebounce(
  value: string,
  delay: number
): [string, Dispatch<SetStateAction<string>>] {
  // State and setters for debounced value
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(
    () => {
      // Update debounced value after delay
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      // Cancel the timeout if value changes (also on delay change or unmount)
      // This is how we prevent debounced value from updating if value is changed ...
      // .. within the delay period. Timeout gets cleared and restarted.
      return () => {
        clearTimeout(handler);
      };
    },
    [value, delay] // Only re-call effect if value or delay changes
  );
  return [debouncedValue, setDebouncedValue];
}
