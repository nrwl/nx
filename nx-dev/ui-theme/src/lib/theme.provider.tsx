import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

const useAvailableLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function changeDocumentClassName(): void {
  if (
    localStorage['theme'] === 'dark' ||
    (!('theme' in localStorage) &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark', 'changing-theme');
  } else {
    document.documentElement.classList.remove('dark', 'changing-theme');
  }
  window.setTimeout(() => {
    document.documentElement.classList.remove('changing-theme');
  });
}

export const ThemeContext = createContext({
  theme: 'system' as 'light' | 'dark' | 'system',
  setTheme: (() => void 0) as Dispatch<SetStateAction<any>>,
});
export const useThemeContext = () => useContext(ThemeContext);

export function useTheme(): [
  'light' | 'dark' | 'system',
  (value: 'light' | 'dark' | 'system') => void
] {
  const [theme, setTheme] = useState('system');
  let initial = useRef(true);

  useAvailableLayoutEffect(() => {
    let theme = localStorage['theme'];
    if (theme === 'light' || theme === 'dark') {
      setTheme(theme);
    }
  }, []);

  useAvailableLayoutEffect(() => {
    if (theme === 'system') {
      localStorage.removeItem('theme');
    } else if (theme === 'light' || theme === 'dark') {
      localStorage['theme'] = theme;
    }
    if (initial.current) {
      initial.current = false;
      return;
    }
    changeDocumentClassName();
  }, [theme]);

  useEffect(() => {
    let mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', changeDocumentClassName);

    function onStorage() {
      changeDocumentClassName();
      let theme = localStorage['theme'];
      if (theme === 'light' || theme === 'dark') {
        setTheme(theme);
      } else {
        setTheme('system');
      }
    }
    window.addEventListener('storage', onStorage);

    return () => {
      mediaQuery.removeEventListener('change', changeDocumentClassName);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return [theme as 'light' | 'dark' | 'system', setTheme];
}

export const ThemeProvider = ({ children }: { children: JSX.Element }) => {
  const [theme, setTheme] = useTheme();

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
