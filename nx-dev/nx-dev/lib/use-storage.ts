import { useState } from 'react';

const isServer = typeof window === 'undefined';

export function useStorage(key: string) {
  const initialValue = isServer ? undefined : window.localStorage.getItem(key);

  const [value, _setValue] = useState<string>(initialValue ?? '');

  const setValue = (newValue: string) => {
    if (newValue !== value && !isServer) {
      window.localStorage.setItem(key, newValue);
      _setValue(newValue);
    }
  };

  return { value, setValue };
}
