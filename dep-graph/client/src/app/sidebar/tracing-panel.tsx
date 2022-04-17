import {
  DotsVerticalIcon,
  FlagIcon,
  LocationMarkerIcon,
  XCircleIcon,
} from '@heroicons/react/solid';
import { memo } from 'react';
import { TracingAlgorithmType } from '../machines/interfaces';

export interface TracingPanelProps {
  start: string;
  end: string;
  algorithm: TracingAlgorithmType;
  resetStart: () => void;
  resetEnd: () => void;
  setAlgorithm: (algorithm: TracingAlgorithmType) => void;
}

export const TracingPanel = memo(
  ({
    start,
    end,
    algorithm,
    setAlgorithm,
    resetStart,
    resetEnd,
  }: TracingPanelProps) => {
    return (
      <div className="mt-10 px-4">
        <div className="transition duration-200 ease-in-out group-hover:opacity-60">
          <h3 className="cursor-text pb-2 text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200 lg:text-xs">
            Tracing Path
          </h3>
          <div className="mb-3 flex cursor-pointer flex-row rounded-md border text-center text-xs dark:border-slate-600">
            <button
              onClick={() => setAlgorithm('shortest')}
              className={`${
                algorithm === 'shortest'
                  ? 'border-blue-nx-base dark:border-slate-200'
                  : 'border-gray-300 dark:border-slate-600'
              } flex-1 rounded-l-md border bg-slate-50 py-2 px-4 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700`}
            >
              <span>Shortest</span>
            </button>
            <button
              onClick={() => setAlgorithm('all')}
              className={`${
                algorithm === 'all'
                  ? 'border-blue-nx-base dark:border-slate-200'
                  : 'border-gray-300 dark:border-slate-600'
              } flex-1 rounded-r-md border bg-slate-50 py-2 px-4 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700`}
            >
              <span>All</span>
            </button>
          </div>

          <div className="flex flex-row items-center truncate ">
            <LocationMarkerIcon className="mr-2 h-5 w-5 text-slate-500 dark:text-slate-400" />
            {start ? (
              <div
                className="group relative flex-1 cursor-pointer flex-col items-center overflow-hidden"
                data-cy="resetTraceButton"
                onClick={resetStart}
              >
                <div className="bg-green-nx-base flex-1 truncate rounded-md border border-slate-200 p-2 text-slate-50 shadow-sm transition duration-200 ease-in-out group-hover:opacity-60 dark:border-slate-700">
                  <span>{start}</span>
                </div>

                <div className="absolute top-2 right-2 flex translate-x-32 items-center rounded-md bg-white pl-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-500 transition-all transition duration-200 ease-in-out group-hover:translate-x-0 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                  Reset
                  <span className="rounded-md p-1">
                    <XCircleIcon className="h-5 w-5"></XCircleIcon>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select start project</p>
            )}
          </div>

          <div>
            <DotsVerticalIcon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </div>

          <div className="flex flex-row items-center truncate ">
            <FlagIcon className="mr-2 h-5 w-5 text-slate-500 dark:text-slate-400" />

            {end ? (
              <div
                className=" group relative flex-1 cursor-pointer flex-col items-center overflow-hidden "
                data-cy="resetTraceButton"
                onClick={resetEnd}
              >
                <div className="bg-green-nx-base flex-1 truncate rounded-md border border-slate-200 p-2 text-slate-50 shadow-sm transition duration-200 ease-in-out group-hover:opacity-60 dark:border-slate-700">
                  <span>{end}</span>
                </div>

                <div className="absolute top-2 right-2 flex translate-x-32 items-center rounded-md bg-white pl-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-500 transition-all transition duration-200 ease-in-out group-hover:translate-x-0 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                  Reset
                  <span className="rounded-md p-1">
                    <XCircleIcon className="h-5 w-5" />
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select end project</p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export default TracingPanel;
