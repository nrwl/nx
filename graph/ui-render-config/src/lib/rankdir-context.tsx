import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { RenderRankDir } from '@nx/graph';

export const localStorageRankDirKey = 'nx-dep-graph-rankdir';

interface RankDirContextValue {
  rankDir: RenderRankDir;
  setRankDir: (rankDir: RenderRankDir) => void;
}

const RankDirContext = createContext<RankDirContextValue | undefined>(
  undefined
);

export function RankDirProvider({ children }: { children: ReactNode }) {
  const [rankDir, setRankDir] = useState<RenderRankDir>(
    (localStorage.getItem(localStorageRankDirKey) as RenderRankDir) || 'TB'
  );

  useEffect(() => {
    localStorage.setItem(localStorageRankDirKey, rankDir);
  }, [rankDir]);

  return (
    <RankDirContext.Provider value={{ rankDir, setRankDir }}>
      {children}
    </RankDirContext.Provider>
  );
}

export function useRankDir() {
  const context = useContext(RankDirContext);
  if (context === undefined) {
    throw new Error('useRankDir must be used within a RankDirProvider');
  }
  return context;
}
