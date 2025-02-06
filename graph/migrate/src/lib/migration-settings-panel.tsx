import { Cog8ToothIcon } from '@heroicons/react/24/outline';
import { Tooltip } from '@nx/graph/ui-tooltips';
import { useState } from 'react';

export interface MigrationSettingsPanelProps {
  automaticMode: boolean;
  setAutomaticMode: (automaticMode: boolean) => void;
  createCommits: boolean;
  setCreateCommits: (createCommits: boolean) => void;
  commitPrefix: string;
  setCommitPrefix: (commitPrefix: string) => void;
}
export function MigrationSettingsPanel({
  automaticMode,
  setAutomaticMode,
  createCommits,
  setCreateCommits,
  commitPrefix,
  setCommitPrefix,
}: MigrationSettingsPanelProps) {
  return (
    <div className="cursor-pointer rounded-full border border-slate-200 p-2 hover:bg-slate-200 dark:border-slate-700/60 dark:hover:bg-slate-700/60">
      <Tooltip
        openAction="click"
        placement="bottom-end"
        content={
          (
            <div>
              <div className="flex items-center gap-2 pb-2">
                <button
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
                  onClick={() => setAutomaticMode(!automaticMode)}
                >
                  {automaticMode
                    ? 'Switch to manual mode'
                    : 'Switch to automatic mode'}
                </button>
              </div>
              <div className="border-b border-slate-200 dark:border-slate-700/60"></div>
              <div className="flex items-center gap-2 py-2">
                <input
                  checked={createCommits}
                  onChange={(e) => setCreateCommits((e.target as any).checked)}
                  id="create-commits"
                  name="create-commits"
                  value="create-commits"
                  type="checkbox"
                  className={`h-4 w-4`}
                />
                <label htmlFor="create-commits">Create commits</label>
              </div>
              <div className="mb-2 border-b border-slate-200 dark:border-slate-700/60"></div>
              <div>
                <label htmlFor="commit-prefix">Commit prefix</label>
                <input
                  type="text"
                  placeholder="chore: [nx migration] "
                  className={`block w-full flex-1 rounded-none rounded-r-md border border-slate-300 bg-white p-1.5 font-light placeholder:font-light placeholder:text-slate-400 dark:border-slate-900 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700`}
                  data-cy="textFilterInput"
                  name="filter"
                  onChange={(event) =>
                    setCommitPrefix(event.currentTarget.value)
                  }
                  value={commitPrefix}
                ></input>
              </div>
            </div>
          ) as any
        }
      >
        <Cog8ToothIcon className="h-6 w-6" />
      </Tooltip>
    </div>
  );
}
