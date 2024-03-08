/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ExpandedInputs } from 'nx/src/command-line/graph/inputs-utils';

import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

export interface TaskInputsListProps {
  projectName: string;
  inputs?: ExpandedInputs;
  inputName: string;
}

export function TaskInputsList({
  projectName,
  inputs,
  inputName,
}: TaskInputsListProps) {
  if (
    !inputs ||
    Object.keys(inputs).length === 0 ||
    Object.values(inputs).flat().length === 0
  )
    return (
      <div className="flex justify-center items-center w-full px-4 py-2">
        No matching files found.
      </div>
    );

  const containsOnlyOneSection =
    Object.values(inputs).filter(
      (plan) => Object.values(plan).flat().length > 0
    ).length === 1;

  return (
    <ul className="max-h-[300px] divide-y divide-slate-200 overflow-auto dark:divide-slate-800">
      {Object.entries(inputs || {})
        .sort(compareInputSectionKeys(projectName))
        .map(([key, plan]) => {
          if (!Object.values(plan).length) return undefined;
          if (
            inputName.startsWith('{projectRoot}') ||
            inputName.startsWith('{workspaceRoot}')
          ) {
            return <InputsLists files={Object.values(plan).flat()} />;
          }
          if (key === projectName) {
            return (
              <>
                {Object.entries(plan).map(([planRegex, files]) => {
                  return (
                    <InputSectionWithPlan planRegex={planRegex} files={files} />
                  );
                })}
              </>
            );
          }
          if (key === 'external') {
            return (
              <InputAccordion
                key={key}
                section={key}
                containsOnlyOneSection={containsOnlyOneSection}
              >
                <InputsLists files={Object.values(plan).flat()} />;
              </InputAccordion>
            );
          }

          return (
            <InputAccordion
              key={key}
              section={key}
              containsOnlyOneSection={containsOnlyOneSection}
            >
              <>
                {Object.entries(plan).map(([planRegex, files]) => {
                  return (
                    <InputSectionWithPlan planRegex={planRegex} files={files} />
                  );
                })}
              </>
            </InputAccordion>
          );
        })}
    </ul>
  );
}

function InputAccordion({
  section,
  containsOnlyOneSection,
  children,
}: {
  section: string;
  containsOnlyOneSection?: boolean;
  children?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // If there is only one section, it should be open by default
  useEffect(() => {
    if (containsOnlyOneSection) {
      setIsOpen(true);
    }
  }, [containsOnlyOneSection]);

  return (
    <>
      <li
        id={section}
        key={section}
        className="flex justify-between items-center whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-300"
        onClick={() => setIsOpen(!isOpen)}
        data-cy="input-section-entry"
      >
        <span className="block truncate font-normal font-bold">{section}</span>
        <span>
          {isOpen ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </span>
      </li>
      {isOpen ? children : null}
    </>
  );
}

function InputsLists({ files }: { files: string[] }): JSX.Element {
  return (
    <>
      {files.map((file, index) => (
        <li
          key={index}
          className="whitespace-nowrap px-4 py-2"
          title={file}
          data-cy="input-list-entry"
        >
          <span className="text-sm font-medium text-slate-800 dark:text-slate-300 block truncate font-normal">
            {file}
          </span>
        </li>
      ))}
    </>
  );
}

function InputSectionWithPlan({
  planRegex,
  files,
}: {
  planRegex: string;
  files: string[];
}): JSX.Element {
  return (
    <>
      <li
        data-cy="input-plan-entry"
        key={planRegex}
        title={planRegex}
        className="whitespace-nowrap px-4 py-2"
      >
        <span className="block truncate text-sm italic">{planRegex}</span>
      </li>
      <ul className="ml-3 divide-y divide-slate-200 overflow-auto dark:divide-slate-800">
        <InputsLists files={files} />
      </ul>
    </>
  );
}

function compareInputSectionKeys(project: string) {
  return (
    [keya]: [string, { [plan: string]: string[] }],
    [keyb]: [string, { [plan: string]: string[] }]
  ) => {
    const first = 'general';
    const second = project;
    const last = 'external';

    // Check if 'keya' and/or 'keyb' are one of the special strings
    if (
      keya === first ||
      keya === second ||
      keya === last ||
      keyb === first ||
      keyb === second ||
      keyb === last
    ) {
      // If 'keya' is 'general', 'keya' should always be first
      if (keya === first) return -1;
      // If 'keyb' is 'general', 'keyb' should always be first
      if (keyb === first) return 1;
      // At this point, we know neither 'keya' nor 'keyb' are 'general'
      // If 'keya' is project, 'keya' should be second (i.e., before 'keyb' unless 'keyb' is 'general')
      if (keya === second) return -1;
      // If 'keyb' is project, 'keyb' should be second (i.e., before 'keya')
      if (keyb === second) return 1;
      // At this point, we know neither 'keya' nor 'keyb' are 'general' or project
      // If 'keya' is 'external', 'keya' should be last (i.e., after 'keyb')
      if (keya === last) return 1;
      // If 'keyb' is 'external', 'keyb' should be last (i.e., after 'keya')
      if (keyb === last) return -1;
    }

    // If neither 'keya' nor 'b' are one of the special strings, sort alphabetically
    if (keya < keyb) {
      return -1;
    }
    if (keya > keyb) {
      return 1;
    }
    return 0;
  };
}
