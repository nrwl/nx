import { memo } from 'react';

export interface CollapseEdgesPanelProps {
  collapseEdges: boolean;
  collapseEdgesChanged: (checked: boolean) => void;
}

export const CollapseEdgesPanel = memo(
  ({ collapseEdges, collapseEdgesChanged }: CollapseEdgesPanelProps) => {
    return (
      <div className="px-4">
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="collapseEdges"
              name="collapseEdges"
              value="collapseEdges"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              onChange={(event) => collapseEdgesChanged(event.target.checked)}
              checked={collapseEdges}
            ></input>
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="collapseEdges"
              className="cursor-pointer font-medium text-gray-700"
            >
              Collapse edges
            </label>
            <p className="text-gray-500">
              Display edges between groups rather than libraries
            </p>
          </div>
        </div>
      </div>
    );
  }
);

export default CollapseEdgesPanel;
