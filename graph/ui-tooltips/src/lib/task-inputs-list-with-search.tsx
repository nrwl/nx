import { useCallback, useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { DebouncedTextInput, Spinner } from '@nx/graph/ui-components';

import { TaskInputsListProps, TaskInputsList } from './task-inputs-list';

export interface TaskInputsListWithSearchProps extends TaskInputsListProps {
  isLoading?: boolean;
}

export function TaskInputsListWithSearch({
  isLoading,
  projectName,
  inputs,
  inputName,
}: TaskInputsListWithSearchProps) {
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
      if (!textFilter) {
        setFilteredInputs(inputs);
        return;
      }
      const filteredInputs: {
        [inputName: string]: { [planRegex: string]: string[] };
      } = {};
      Object.keys(inputs).forEach((inputName) => {
        Object.keys(inputs[inputName]).forEach((planRegex) => {
          const filteredFiles = inputs[inputName][planRegex].filter(
            (filePlan) => {
              return new RegExp(textFilter, 'i').test(filePlan);
            }
          );
          if (filteredFiles.length) {
            if (!filteredInputs[inputName]) {
              filteredInputs[inputName] = {};
            }
            if (!filteredInputs[inputName][planRegex]) {
              filteredInputs[inputName][planRegex] = filteredFiles;
            }
          }
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
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div className="pb-3 px-3">
        <DebouncedTextInput
          resetTextFilter={resetTextFilter}
          updateTextFilter={updateTextFilter}
          initialText={''}
          placeholderText={'Search files'}
          Icon={MagnifyingGlassIcon}
        ></DebouncedTextInput>
      </div>
      <TaskInputsList
        projectName={projectName}
        inputs={filteredInputs}
        inputName={inputName}
      />
    </>
  );
}
