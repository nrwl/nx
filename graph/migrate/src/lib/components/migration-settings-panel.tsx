import { useState } from 'react';
import { Popover } from '@nx/graph/ui-common';

export interface MigrationSettingsPanelProps {
  createCommits: boolean;
  setCreateCommits: (createCommits: boolean) => void;
  commitPrefix: string;
  setCommitPrefix: (commitPrefix: string) => void;
}

export function MigrationSettingsPanel({
  createCommits,
  setCreateCommits,
  commitPrefix,
  setCommitPrefix,
}: MigrationSettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
      >
        Settings
      </button>
      <Popover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        position={{ left: '-12rem', top: '2.75rem' }}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 py-2">
            <input
              checked={createCommits}
              onChange={(e) => setCreateCommits(e.target.checked)}
              id="create-commits"
              name="create-commits"
              value="create-commits"
              type="checkbox"
              className="h-4 w-4"
            />
            <label htmlFor="create-commits">Create commits</label>
          </div>
          <div className="mb-2 border-b border-slate-200/25 dark:border-slate-700/25"></div>
          <div className="flex flex-col gap-2">
            <label htmlFor="commit-prefix">Commit prefix</label>
            <input
              type="text"
              placeholder="chore: [nx migration] "
              className="block w-full flex-1 rounded-md border border-slate-300/[0.25] bg-white p-1.5 font-light placeholder:font-light placeholder:text-slate-400 dark:border-slate-900 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              data-cy="textFilterInput"
              name="filter"
              onChange={(event) => setCommitPrefix(event.currentTarget.value)}
              value={commitPrefix}
            />
          </div>
        </div>
      </Popover>
    </div>
  );
}
