import { memo } from 'react';

export interface DisplayOptionsPanelProps {
  groupByFolderChanged: (checked: boolean) => void;
}

export const GroupByFolderPanel = memo(
  ({ groupByFolderChanged }: DisplayOptionsPanelProps) => {
    return (
      <div className="mt-8 px-4">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="displayOptions"
              name="displayOptions"
              value="groupByFolder"
              type="checkbox"
              className="h-4 w-4 border-gray-300 rounded"
              onChange={(event) => groupByFolderChanged(event.target.checked)}
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
