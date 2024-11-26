import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { TaskNodeTooltipProps } from '@nx/graph/ui-tooltips';
import { useEffect, useState } from 'react';

export function TaskNodeActions(props: TaskNodeTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    setIsOpen(false);
  }, [props.id]);
  const project = props.id.split(':')[0];
  return (
    <div className="w-full w-full min-w-[350px] max-w-full overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
      <div
        className="flex w-full items-center justify-between bg-slate-50 px-4 py-2 text-xs font-medium uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        onClick={() => setIsOpen(!isOpen)}
        data-cy="inputs-accordion"
      >
        <span>Inputs</span>
        <span>
          {isOpen ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </span>
      </div>
      <ul
        className={`max-h-[300px] divide-y divide-slate-200 overflow-auto dark:divide-slate-800 ${
          !isOpen && 'hidden'
        }`}
      >
        {Object.entries(props.inputs ?? {})
          .sort(compareInputSectionKeys(project))
          .map(([key, inputs]) => {
            if (!inputs.length) return undefined;
            if (key === 'general' || key === project) {
              return renderInputs(inputs);
            }
            if (key === 'external') {
              return InputAccordion({ section: 'External Inputs', inputs });
            }

            return InputAccordion({ section: key, inputs });
          })}
      </ul>
    </div>
  );
}

function InputAccordion({ section, inputs }) {
  const [isOpen, setIsOpen] = useState(false);

  return [
    <li
      key={section}
      className="flex items-center justify-between whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-300"
      onClick={() => setIsOpen(!isOpen)}
      data-cy="input-section-entry"
    >
      <span className="block truncate font-bold font-normal">{section}</span>
      <span>
        {isOpen ? (
          <ChevronUpIcon className="h-4 w-4" />
        ) : (
          <ChevronDownIcon className="h-4 w-4" />
        )}
      </span>
    </li>,
    isOpen ? renderInputs(inputs) : undefined,
  ];
}

function renderInputs(inputs: string[]) {
  return inputs.map((input) => (
    <li
      key={input}
      className="whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-300"
      title={input}
      data-cy="input-list-entry"
    >
      <span className="block truncate font-normal">{input}</span>
    </li>
  ));
}

function compareInputSectionKeys(project: string) {
  return ([keya]: [string, string[]], [keyb]: [string, string[]]) => {
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
