import { DebouncedTextInput } from '@nx/graph/ui-components';

export interface TextFilterPanelProps {
  textFilter: string;
  resetTextFilter: () => void;
  updateTextFilter: (textFilter: string) => void;
  toggleIncludeLibsInPathChange: () => void;
  includePath: boolean;
}

export function TextFilterPanel({
  textFilter,
  resetTextFilter,
  updateTextFilter,
  toggleIncludeLibsInPathChange,
  includePath,
}: TextFilterPanelProps) {
  return (
    <div>
      <div className="mt-10 px-4">
        <DebouncedTextInput
          resetTextFilter={resetTextFilter}
          updateTextFilter={updateTextFilter}
          initialText={''}
          placeholderText={'lib name, other lib name'}
        ></DebouncedTextInput>
      </div>

      <div className="mt-4 px-4">
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              disabled={textFilter.length === 0}
              id="includeInPath"
              name="textFilterCheckbox"
              type="checkbox"
              value="includeInPath"
              className="h-4 w-4 accent-blue-500 dark:accent-sky-500"
              checked={includePath}
              onChange={toggleIncludeLibsInPathChange}
            />
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="includeInPath"
              className="cursor-pointer font-medium text-slate-600 dark:text-slate-400"
            >
              Include related libraries
            </label>
            <p className="text-slate-400 dark:text-slate-500">
              Show libraries that are related to your search.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
