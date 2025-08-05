import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  Theme,
  themeResolver,
  localStorageThemeKey,
  getSystemTheme,
} from './theme-resolver';
import { RenderTheme } from '@nx/graph';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: RenderTheme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem(localStorageThemeKey) as Theme) || 'system'
  );
  const [resolvedTheme, setResolvedTheme] = useState<RenderTheme>(() =>
    theme === 'system' ? getSystemTheme() : theme
  );

  useEffect(() => {
    themeResolver(theme, setResolvedTheme);
  }, [theme, setResolvedTheme]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme: handleSetTheme, resolvedTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
