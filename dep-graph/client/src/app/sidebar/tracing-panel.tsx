import { XCircleIcon } from '@heroicons/react/solid';
import { memo } from 'react';
import Flag from '../icons/flag';
import MapMarker from '../icons/map-marker';

export interface TracingPanelProps {
  start: string;
  end: string;
  resetStart: () => void;
  resetEnd: () => void;
}

export const TracingPanel = memo(
  ({ start, end, resetStart, resetEnd }: TracingPanelProps) => {
    return (
      <div className="mt-10 px-4">
        <div className="transition duration-200 ease-in-out group-hover:opacity-60">
          <h3 className="cursor-text pb-2 text-sm font-semibold uppercase tracking-wide text-gray-900 lg:text-xs ">
            Tracing Path
          </h3>
          <div className="flex flex-row items-center truncate ">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2 h-5 w-5 text-gray-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            {start ? (
              <div
                className=" group relative flex-1 cursor-pointer flex-col items-center overflow-hidden "
                data-cy="resetTraceButton"
                onClick={resetStart}
              >
                <div className="bg-green-nx-base flex-1 truncate rounded-md border border-gray-200 p-2 text-gray-50 shadow-sm transition duration-200 ease-in-out group-hover:opacity-60">
                  <span>{start}</span>
                </div>

                <div className="absolute top-2 right-2 flex translate-x-32 items-center rounded-md bg-white pl-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-500 transition-all transition duration-200 ease-in-out group-hover:translate-x-0">
                  Reset
                  <span className="rounded-md p-1">
                    <XCircleIcon className="h-5 w-5"></XCircleIcon>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select start project</p>
            )}
          </div>

          <div>
            <MapMarker className="h-5 w-5 text-gray-500"></MapMarker>
          </div>

          <div className="flex flex-row items-center truncate ">
            <Flag className="mr-2 h-5 w-5 text-gray-500"></Flag>

            {end ? (
              <div
                className=" group relative flex-1 cursor-pointer flex-col items-center overflow-hidden "
                data-cy="resetTraceButton"
                onClick={resetEnd}
              >
                <div className="bg-green-nx-base flex-1 truncate rounded-md border border-gray-200 p-2 text-gray-50 shadow-sm transition duration-200 ease-in-out group-hover:opacity-60">
                  <span>{end}</span>
                </div>

                <div className="absolute top-2 right-2 flex translate-x-32 items-center rounded-md bg-white pl-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-500 transition-all transition duration-200 ease-in-out group-hover:translate-x-0">
                  Reset
                  <span className="rounded-md p-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select end project</p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export default TracingPanel;
