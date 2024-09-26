import { memo } from 'react';

export interface CompositeGraphPanelProps {
  compositeEnabled: boolean;
  compositeEnabledChanged: (checked: boolean) => void;
}

export const CompositeGraphPanel = memo(
  ({ compositeEnabled, compositeEnabledChanged }: CompositeGraphPanelProps) => {
    return (
      <div className="mt-4 px-4">
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="composite"
              name="composite"
              value="composite"
              type="checkbox"
              className="h-4 w-4 accent-blue-500 dark:accent-sky-500"
              onChange={(event) =>
                compositeEnabledChanged(event.target.checked)
              }
              checked={compositeEnabled}
            />
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="composite"
              className="cursor-pointer font-medium text-slate-600 dark:text-slate-400"
            >
              Composite Graph
            </label>
            <p className="text-slate-400 dark:text-slate-500">
              Enables experimental composite graph with composite nodes and
              edges
            </p>
          </div>
        </div>
      </div>
    );
  }
);
