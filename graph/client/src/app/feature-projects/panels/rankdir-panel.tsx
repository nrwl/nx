import {
  ArrowsRightLeftIcon,
  ArrowsUpDownIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { RenderRankDir } from '@nx/graph';

export const localStorageRankDirKey = 'nx-dep-graph-rankdir';

export function RankdirPanel({
  onRankDirChange,
}: {
  onRankDirChange?: (rankDir: RenderRankDir) => void;
}): JSX.Element {
  const [rankDir, setRankDir] = useState(
    (localStorage.getItem(localStorageRankDirKey) as RenderRankDir) || 'TB'
  );

  useEffect(() => {
    localStorage.setItem(localStorageRankDirKey, rankDir);
    if (onRankDirChange) {
      onRankDirChange(rankDir);
    }
  }, [rankDir]);

  return (
    <div className="relative inline-block text-left">
      {rankDir === 'TB' && (
        <button
          className="inline-flex w-full justify-center rounded-md p-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 dark:text-sky-500"
          title="Set graph direction to left-to-right"
          data-cy="rankdir-change-button"
          onClick={() => setRankDir('LR')}
        >
          <span className="sr-only">Set graph direction to left-to-right</span>
          <ArrowsUpDownIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {rankDir === 'LR' && (
        <button
          className="inline-flex w-full justify-center rounded-md p-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 dark:text-sky-500"
          title="Set graph direction to top-to-bottom"
          data-cy="rankdir-change-button"
          onClick={() => setRankDir('TB')}
        >
          <span className="sr-only">Set graph direction to top-to-bottom</span>
          <ArrowsRightLeftIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
