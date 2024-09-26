import { memo } from 'react';
import classNames from 'classnames';

export interface CheckboxPanelProps {
  checked: boolean;
  checkChanged: (checked: boolean) => void;
  name: string;
  label: string;
  description: string;
  disabled?: boolean;
  disabledDescription?: string;
}

export const CheckboxPanel = memo(
  ({
    checked,
    checkChanged,
    label,
    description,
    name,
    disabled,
    disabledDescription,
  }: CheckboxPanelProps) => {
    return (
      <div
        className={classNames(
          'mt-8 px-4',
          disabled ? 'cursor-not-allowed opacity-50' : ''
        )}
        title={disabled ? disabledDescription : description}
      >
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
              disabled={disabled}
            />
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor={name}
              className={classNames(
                ' font-medium text-slate-600 dark:text-slate-400',
                disabled ? 'cursor-not-allowed' : 'cursor-pointer'
              )}
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
