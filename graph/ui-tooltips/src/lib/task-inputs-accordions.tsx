/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ExpandedInputs } from 'nx/src/command-line/graph/inputs-utils';

import {
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { DebouncedTextInput } from '@nx/graph/ui-components';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { TaskInputsList } from './task-inputs-list';

export interface TaskInputsListAccordionProps {
  projectName: string;
  inputs: { [inputName: string]: ExpandedInputs };
  isLoading?: boolean;
}

export function TaskInputsListAccordions({
  projectName,
  inputs,
  isLoading,
}: TaskInputsListAccordionProps) {
  const [filteredInputs, setFilteredInputs] = useState(inputs);

  const resetTextFilter = useCallback(() => {
    setFilteredInputs(inputs);
  }, [inputs]);

  const updateTextFilter = useCallback(
    (textFilter: string) => {
      if (!inputs || Object.keys(inputs).length === 0) {
        setFilteredInputs({});
        return;
      }
      if (!textFilter || textFilter.length === 0) {
        setFilteredInputs(inputs);
        return;
      }
      const filteredInputs: Record<string, ExpandedInputs> = {};
      Object.keys(inputs).forEach((namedInput) => {
        Object.keys(inputs[namedInput]).forEach((key) => {
          Object.keys(inputs[namedInput][key]).forEach((plan) => {
            const filteredFiles = inputs[namedInput][key][plan].filter(
              (file) => {
                return new RegExp(textFilter, 'i').test(file);
              }
            );
            if (filteredFiles.length) {
              if (!filteredInputs[namedInput]) {
                filteredInputs[namedInput] = {};
              }
              if (!filteredInputs[namedInput][key]) {
                filteredInputs[namedInput][key] = {};
              }
              filteredInputs[namedInput][key][plan] = filteredFiles;
            }
          });
        });
      });
      setFilteredInputs(filteredInputs);
    },
    [inputs]
  );

  useEffect(() => {
    setFilteredInputs(inputs);
  }, [inputs]);

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }
  if (!inputs || Object.keys(inputs).length === 0) return null;

  return (
    <>
      <div className="pb-3 px-3" data-cy="inputs-accordions">
        <DebouncedTextInput
          resetTextFilter={resetTextFilter}
          updateTextFilter={updateTextFilter}
          initialText={''}
          placeholderText={'Search files'}
          Icon={MagnifyingGlassIcon}
        ></DebouncedTextInput>
      </div>
      {filteredInputs && Object.keys(filteredInputs).length > 0 ? (
        Object.entries(filteredInputs || {}).map(([key, files]) => (
          <TaskInputsListAccordion
            heading={key}
            key={key}
            containsOnlyOneSection={Object.keys(filteredInputs).length === 1}
          >
            <TaskInputsList
              projectName={projectName}
              inputs={files}
              inputName={key}
            />
          </TaskInputsListAccordion>
        ))
      ) : (
        <div className="flex justify-center items-center w-full px-4 py-2">
          No matching files found.
        </div>
      )}
    </>
  );
}

export function TaskInputsListAccordion({
  children,
  heading,
  containsOnlyOneSection,
}: {
  children: ReactNode;
  heading: string;
  containsOnlyOneSection: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (containsOnlyOneSection) {
      setIsOpen(true);
    }
  }, [containsOnlyOneSection]);

  return (
    <div className="overflow-auto w-full min-w-[350px] max-w-full rounded-md border border-slate-200 dark:border-slate-800 mt-2">
      <div
        className="flex justify-between items-center w-full bg-slate-50 px-4 py-2 text-xs font-medium uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        onClick={() => setIsOpen(!isOpen)}
        data-cy="inputs-accordion"
      >
        <span>{heading}</span>
        <span>
          {isOpen ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </span>
      </div>
      {isOpen ? children : undefined}
    </div>
  );
}
