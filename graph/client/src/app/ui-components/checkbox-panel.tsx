import { memo } from 'react';

export interface CheckboxPanelProps {
  checked: boolean;
  checkChanged: (checked: boolean) => void;
  name: string;
  label: string;
  description: string;
}

export const CheckboxPanel = memo(
  ({ checked, checkChanged, label, description, name }: CheckboxPanelProps) => {
    return (
      <div className="mt-8 px-4">
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id={name}
              name={name}
              value={name}
              type="checkbox"
              className="h-4 w-4 accent-blue-500 dark:accent-sky-500"
              onChange={(event) => checkChanged(event.target.checked)}
              checked={checked}
            />
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor={name}
              className="cursor-pointer font-medium text-slate-600 dark:text-slate-400"
            >
              {label}
            </label>
            <p className="text-slate-400 dark:text-slate-500">{description}</p>
          </div>
        </div>
      </div>
    );
  }
);
