import { useState, useRef, useEffect, useCallback } from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  debounceMs?: number;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select options...',
  className = '',
  id,
  debounceMs = 300,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<string[]>(value);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setPendingValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const debouncedOnChange = useCallback(
    (newValue: string[]) => {
      setPendingValue(newValue);

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  const handleOptionToggle = (optionValue: string) => {
    const newValue = pendingValue.includes(optionValue)
      ? pendingValue.filter((v) => v !== optionValue)
      : [...pendingValue, optionValue];
    debouncedOnChange(newValue);
  };

  const handleSelectAll = () => {
    const filteredValues = filteredOptions.map((option) => option.value);
    const allFilteredSelected = filteredValues.every((value) =>
      pendingValue.includes(value)
    );

    if (allFilteredSelected && filteredValues.length > 0) {
      // Remove all filtered options from selection
      debouncedOnChange(
        pendingValue.filter((value) => !filteredValues.includes(value))
      );
    } else {
      // Add all filtered options to selection
      const newValue = [...new Set([...pendingValue, ...filteredValues])];
      debouncedOnChange(newValue);
    }
  };

  const selectedCount = pendingValue.length;
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const removeValue = (valueToRemove: string) => {
    debouncedOnChange(pendingValue.filter((v) => v !== valueToRemove));
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        className="shadow-xs flex min-h-[40px] w-full cursor-pointer items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex min-h-[24px] flex-1 flex-wrap items-center gap-1">
          {selectedCount === 0 ? (
            <span className="text-slate-500 dark:text-slate-400">
              {placeholder}
            </span>
          ) : selectedCount > 3 ? (
            <span className="text-slate-700 dark:text-slate-300">
              {selectedCount} targets selected
            </span>
          ) : (
            pendingValue.map((selectedValue) => {
              const option = options.find((opt) => opt.value === selectedValue);
              return (
                <div
                  key={selectedValue}
                  className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>{option?.label || selectedValue}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeValue(selectedValue);
                    }}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
        <ChevronDownIcon
          className={`ml-2 h-4 w-4 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {/* Search input */}
          <div className="border-b border-slate-200 p-2 dark:border-slate-600">
            <input
              type="text"
              placeholder="Search targets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-auto">
            {/* Select All / Clear All option */}
            <div
              className="flex cursor-pointer items-center px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              onClick={handleSelectAll}
            >
              <div className="mr-3 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-slate-300 dark:border-slate-600">
                {(() => {
                  const filteredValues = filteredOptions.map(
                    (opt) => opt.value
                  );
                  const allFilteredSelected = filteredValues.every((value) =>
                    pendingValue.includes(value)
                  );
                  const someFilteredSelected = filteredValues.some((value) =>
                    pendingValue.includes(value)
                  );

                  if (allFilteredSelected && filteredValues.length > 0) {
                    return (
                      <CheckIcon className="h-3 w-3 text-blue-500 dark:text-sky-500" />
                    );
                  } else if (someFilteredSelected) {
                    return (
                      <div className="h-2 w-2 rounded-sm bg-blue-500 dark:bg-sky-500" />
                    );
                  }
                  return null;
                })()}
              </div>
              <span className="min-w-0 flex-1 font-medium text-slate-700 dark:text-slate-300">
                {(() => {
                  const filteredValues = filteredOptions.map(
                    (opt) => opt.value
                  );
                  const allFilteredSelected = filteredValues.every((value) =>
                    pendingValue.includes(value)
                  );
                  return allFilteredSelected && filteredValues.length > 0
                    ? 'Clear All'
                    : 'Select All';
                })()}
              </span>
            </div>

            {/* Separator */}
            <div className="border-t border-slate-200 dark:border-slate-600" />

            {/* Individual options */}
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                No targets found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = pendingValue.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className="flex cursor-pointer items-center px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    onClick={() => handleOptionToggle(option.value)}
                  >
                    <div className="mr-3 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-slate-300 dark:border-slate-600">
                      {isSelected && (
                        <CheckIcon className="h-3 w-3 text-blue-500 dark:text-sky-500" />
                      )}
                    </div>
                    <span
                      className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300"
                      title={option.label}
                    >
                      {option.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
