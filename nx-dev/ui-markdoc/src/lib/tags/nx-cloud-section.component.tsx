import { ReactNode } from 'react';

export function NxCloudSection({ children }: { children: ReactNode }) {
  return (
    <div className="border-green-nx-base mt-16 mb-4 border-l-4 pl-4">
      <aside className="not-prose mb-4 flex flex-wrap items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4">
        <div className="flex flex w-0 flex-1 items-center">
          <span className="flex">
            <svg
              className="h-10 w-10 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 128 128"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                d="M128 16V32C110.336 32 96 46.336 96 64C96 81.664 81.664 96 64 96C46.336 96 32 110.336 32 128H16C7.168 128 0 120.832 0 112V16C0 7.168 7.168 0 16 0H112C120.832 0 128 7.168 128 16Z"
                fill="#0E2039"
              />
              <path
                d="M128 32V112C128 120.832 120.832 128 112 128H32C32 110.336 46.336 96 64 96C81.664 96 96 81.664 96 64C96 46.336 110.336 32 128 32Z"
                fill="white"
              />
            </svg>
          </span>
          <p className="ml-4 flex text-base">
            This section is about Nx Cloud specifically.
          </p>
        </div>
        <div className="order-3 mt-2 w-full flex-shrink-0 sm:order-2 sm:mt-0 sm:w-auto">
          <a
            href="https://nx.app/?utm_source=nxdev"
            className="text-blue-nx-base flex items-center justify-center rounded-md border border-transparent bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-100"
          >
            Learn more
          </a>
        </div>
      </aside>

      {children}
    </div>
  );
}
