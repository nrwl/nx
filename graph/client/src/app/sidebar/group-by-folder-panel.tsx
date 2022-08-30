import { memo } from 'react';

export interface DisplayOptionsPanelProps {
  groupByFolder: boolean;
  groupByFolderChanged: (checked: boolean) => void;
}

export const GroupByFolderPanel = memo(
  ({ groupByFolder, groupByFolderChanged }: DisplayOptionsPanelProps) => {
    return (
      <div className="mt-8 px-4">
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="displayOptions"
              name="displayOptions"
              value="groupByFolder"
              type="checkbox"
              className="accent-green-nx-base h-4 w-4"
              onChange={(event) => groupByFolderChanged(event.target.checked)}
              checked={groupByFolder}
            />
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="displayOptions"
              className="cursor-pointer font-medium text-slate-600 dark:text-slate-400"
            >
              Group by folder
            </label>
            <p className="text-slate-400 dark:text-slate-500">
              Visually arrange libraries by folders with different colors.
            </p>
          </div>
        </div>
      </div>
    );
  }
);

export default GroupByFolderPanel;
