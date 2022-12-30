import { useMemo, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [subscribe, getSnapshot, getServerSnapshot] = useMemo(() => {
    return [
      (notify: () => void) => {
        const handleStorageEvent = (evt: StorageEvent) => {
          if (evt.key === 'theme') {
            changeDocumentClassName();
            notify();
          }
        };
        const changeDocumentClassName = () => {
          if (
            localStorage['theme'] === 'dark' ||
            ((!localStorage['theme'] || localStorage['theme'] === 'system') &&
              window.matchMedia('(prefers-color-scheme: dark)').matches)
          ) {
            document.documentElement.classList.add('dark', 'changing-theme');
          } else {
            document.documentElement.classList.remove('dark', 'changing-theme');
          }
          window.setTimeout(() => {
            document.documentElement.classList.remove('changing-theme');
          });
        };

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', changeDocumentClassName);

        window.addEventListener('storage', handleStorageEvent);

        changeDocumentClassName();

        return () => {
          mediaQuery.removeEventListener('change', changeDocumentClassName);
          window.removeEventListener('storage', handleStorageEvent);
        };
      },
      () => window.localStorage['theme'] ?? 'system',
      () => 'system',
    ];
  }, []);

  return [
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
    (theme: Theme) => {
      localStorage['theme'] = theme;
      // For current window
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'theme',
          newValue: theme,
        })
      );
    },
  ];
}
