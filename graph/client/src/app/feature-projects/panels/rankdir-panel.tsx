import {
  ArrowsRightLeftIcon,
  ArrowsUpDownIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import {
  localStorageRankDirKey,
  RankDir,
  rankDirResolver,
} from '../../rankdir-resolver';

export function RankdirPanel(): JSX.Element {
  const [rankDir, setRankDir] = useState(
    (localStorage.getItem(localStorageRankDirKey) as RankDir) || 'TB'
  );

  useEffect(() => {
    rankDirResolver(rankDir);
  }, [rankDir]);

  return (
    <div className="relative inline-block text-left">
      <button
        className="inline-flex w-full justify-center rounded-md p-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 dark:text-sky-500"
        data-cy="rankdir-change-button"
      >
        <span className="sr-only">Graph layout direction switcher</span>
        {rankDir === 'TB' && (
          <button
            title="Set graph direction to left-to-right"
            data-cy="lr-rankdir-button"
            onClick={() => setRankDir('LR')}
          >
            <ArrowsUpDownIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {rankDir === 'LR' && (
          <button
            title="Set graph direction to top-to-bottom"
            data-cy="tb-rankdir-button"
            onClick={() => setRankDir('TB')}
          >
            <ArrowsRightLeftIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </button>
    </div>
  );
}
