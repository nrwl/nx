import classNames from 'classnames';
import { memo } from 'react';

export interface CollapseEdgesPanelProps {
  collapseEdges: boolean;
  collapseEdgesChanged: (checked: boolean) => void;
  disabled?: boolean;
}

export const CollapseEdgesPanel = memo(
  ({
    collapseEdges,
    collapseEdgesChanged,
    disabled,
  }: CollapseEdgesPanelProps) => {
    return (
      <div
        className={classNames(
          'px-4',
          disabled ? 'cursor-not-allowed opacity-50' : ''
        )}
        title={
          disabled
            ? 'Group by folder is not enabled'
            : 'Collapse edges between groups of projects'
        }
      >
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="collapseEdges"
              name="collapseEdges"
              value="collapseEdges"
              type="checkbox"
              className="h-4 w-4 accent-purple-500"
              onChange={(event) => collapseEdgesChanged(event.target.checked)}
              checked={collapseEdges}
              disabled={disabled}
            />
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="collapseEdges"
              className="cursor-pointer font-medium text-slate-600 dark:text-slate-400"
            >
              Collapse edges
            </label>
            <p className="text-slate-400 dark:text-slate-500">
              Display edges between groups rather than libraries
            </p>
          </div>
        </div>
      </div>
    );
  }
);
