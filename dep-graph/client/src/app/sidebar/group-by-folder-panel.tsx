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
              className="h-4 w-4 rounded border-gray-300"
              onChange={(event) => groupByFolderChanged(event.target.checked)}
              checked={groupByFolder}
            ></input>
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="displayOptions"
              className="cursor-pointer font-medium text-gray-700"
            >
              Group by folder
            </label>
            <p className="text-gray-500">
              Visually arrange libraries by folders with different colors.
            </p>
          </div>
        </div>
      </div>
    );
  }
);

export default GroupByFolderPanel;
