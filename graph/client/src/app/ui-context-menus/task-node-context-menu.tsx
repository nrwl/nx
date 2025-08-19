import type { RenderPlatform, TaskNodeElementData } from '@nx/graph';
import { Tag } from '@nx/graph-ui-common';
import {
  DocumentMagnifyingGlassIcon,
  PencilSquareIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { getProjectGraphDataService } from '@nx/graph-shared';
import { useEffect, useMemo, useState } from 'react';
import { ContextMenuList } from './context-menu-list';

export interface TaskNodeContextMenuProps {
  data: TaskNodeElementData;
  renderPlatform: RenderPlatform;
  onConfigClick: () => void;
  onRunTaskClick: () => void;
}

function compareInputSectionKeys(project: string) {
  return (keya: string, keyb: string) => {
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

    // If neither 'keya' nor 'keyb' are one of the special strings, sort alphabetically
    if (keya < keyb) {
      return -1;
    }
    if (keya > keyb) {
      return 1;
    }
    return 0;
  };
}

export function TaskNodeContextMenu({
  data,
  renderPlatform,
  onConfigClick,
  onRunTaskClick,
}: TaskNodeContextMenuProps) {
  const projectGraphDataService = getProjectGraphDataService();
  const [inputs, setInputs] = useState<Record<string, string[]> | null>(null);

  useEffect(() => {
    // Only fetch if the service has the method
    if (!projectGraphDataService.getExpandedTaskInputs) return;

    projectGraphDataService
      .getExpandedTaskInputs(data.name)
      .then((expandedInputs) => {
        setInputs(expandedInputs);
      })
      .catch((error) => {
        console.error('Failed to fetch task inputs:', error);
      });
  }, [data.name, projectGraphDataService]);

  const inputSections = useMemo(() => {
    const sections = [];

    if (!inputs) return sections;

    const project = data.name.split(':')[0];
    const sortedKeys = Object.keys(inputs).sort(
      compareInputSectionKeys(project)
    );

    for (const key of sortedKeys) {
      const values = inputs[key];
      if (values.length === 0) continue;

      let label = key;
      if (key === 'general') label = 'General Inputs';
      else if (key === 'external') label = 'External Inputs';

      sections.push({ label, items: values });
    }

    return sections;
  }, [inputs, data.name]);

  return (
    <div className="flex w-[32rem] max-w-[32rem] flex-col gap-4 rounded-md border border-black p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag>{data.executor}</Tag>
          <span className="font-mono">{data.label}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="shadow-xs flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-500 ring-1 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700"
            title={
              renderPlatform === 'nx-console'
                ? 'Open project details in editor'
                : 'Open project details'
            }
            onClick={onConfigClick}
          >
            {renderPlatform === 'nx-console' ? (
              <PencilSquareIcon className="h-5 w-5" />
            ) : (
              <DocumentMagnifyingGlassIcon className="h-5 w-5" />
            )}
          </button>
          {renderPlatform === 'nx-console' ? (
            <button
              className="shadow-xs flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-500 ring-1 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700"
              title="Run Task"
              onClick={onRunTaskClick}
            >
              <PlayIcon className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      {data.description ? <p>{data.description}</p> : null}

      <ContextMenuList sections={inputSections} isLoading={!inputs} />
    </div>
  );
}
