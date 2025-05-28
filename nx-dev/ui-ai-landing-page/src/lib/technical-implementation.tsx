import {
  ModelContextProtocolIcon,
  NxConsoleSmallIcon,
} from '@nx/nx-dev/ui-icons';
import Image from 'next/image';

export interface TechnicalImplementationProps {
  className?: string;
}

export function TechnicalImplementation({
  className,
}: TechnicalImplementationProps): JSX.Element {
  return (
    <section
      className={`bg-gradient-to-b from-white to-slate-50 py-12 dark:from-slate-900 dark:to-slate-800 ${
        className || ''
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
          {/* Left Side - Title and How It Works */}
          <div className="flex flex-col justify-center">
            <h2 className="mb-8 text-left text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
              Powered by Nx workspace intelligence
            </h2>

            <div className="space-y-6">
              <div className="flex items-start">
                <div className="mr-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                  <span className="text-lg font-semibold">1</span>
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-slate-600 dark:text-slate-300">
                    Nx daemon runs in the background, maintaining up-to-date
                    workspace metadata
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="mr-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                  <span className="text-lg font-semibold">2</span>
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-slate-600 dark:text-slate-300">
                    This rich contextual data is processed and optimized for AI
                    consumption
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="mr-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                  <span className="text-lg font-semibold">3</span>
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-slate-600 dark:text-slate-300">
                    Nx Console exposes the data to your AI assistant via an MCP
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Image */}
          <div className="flex h-full items-center justify-center">
            <div className="relative h-[300px] w-full md:h-[400px] lg:h-[450px]">
              <Image
                src="/images/nx-console/nx-mcp-landingpage-img.avif"
                alt="Nx MCP visualization"
                fill
                style={{ objectFit: 'contain' }}
                className="rounded-lg"
                priority
              />
            </div>
          </div>
        </div>

        <div className="relative mt-8 lg:mt-12">
          {/* Flow diagram with connected boxes */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
            {/* Nx Console Box */}
            <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-md dark:border-slate-700 dark:bg-slate-800/50">
              <div className="mb-4 flex items-center">
                <div className="mr-4 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                  <NxConsoleSmallIcon className="h-24 w-24" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                  Start with Nx Console
                </h4>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Install the Nx Console Extension, available for VSCode, Cursor,
                and IntelliJ.
              </p>

              {/* Right arrow - only visible on md and larger screens */}
              <div className="absolute -right-5 top-1/2 hidden -translate-y-1/2 md:block">
                <svg
                  width="40"
                  height="24"
                  viewBox="0 0 40 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-blue-500 dark:text-blue-400"
                >
                  <path
                    d="M39.0607 13.0607C39.6464 12.4749 39.6464 11.5251 39.0607 10.9393L29.5147 1.3934C28.9289 0.807611 27.9792 0.807611 27.3934 1.3934C26.8076 1.97919 26.8076 2.92893 27.3934 3.51472L35.8787 12L27.3934 20.4853C26.8076 21.0711 26.8076 22.0208 27.3934 22.6066C27.9792 23.1924 28.9289 23.1924 29.5147 22.6066L39.0607 13.0607ZM0 13.5H38V10.5H0V13.5Z"
                    fill="currentColor"
                  />
                </svg>
              </div>

              {/* Down arrow - only visible on small screens */}
              <div className="absolute -bottom-8 left-1/2 block -translate-x-1/2 md:hidden">
                <svg
                  width="24"
                  height="40"
                  viewBox="0 0 24 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-blue-500 dark:text-blue-400"
                >
                  <path
                    d="M13.0607 39.0607C12.4749 39.6464 11.5251 39.6464 10.9393 39.0607L1.3934 29.5147C0.807611 28.9289 0.807611 27.9792 1.3934 27.3934C1.97919 26.8076 2.92893 26.8076 3.51472 27.3934L12 35.8787L20.4853 27.3934C21.0711 26.8076 22.0208 26.8076 22.6066 27.3934C23.1924 27.9792 23.1924 28.9289 22.6066 29.5147L13.0607 39.0607ZM13.5 0V38H10.5V0H13.5Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </div>

            {/* MCP Box */}
            <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-md dark:border-slate-700 dark:bg-slate-800/50">
              <div className="mb-4 flex items-center">
                <div className="mr-4 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white">
                  <ModelContextProtocolIcon className="h-8 w-8" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                  Nx MCP
                </h4>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Nx Console automatically registers its MCP server or you can
                configure it in any MCP compatible client.
              </p>

              {/* Right arrow - only visible on md and larger screens */}
              <div className="absolute -right-5 top-1/2 hidden -translate-y-1/2 md:block">
                <svg
                  width="40"
                  height="24"
                  viewBox="0 0 40 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-blue-500 dark:text-blue-400"
                >
                  <path
                    d="M39.0607 13.0607C39.6464 12.4749 39.6464 11.5251 39.0607 10.9393L29.5147 1.3934C28.9289 0.807611 27.9792 0.807611 27.3934 1.3934C26.8076 1.97919 26.8076 2.92893 27.3934 3.51472L35.8787 12L27.3934 20.4853C26.8076 21.0711 26.8076 22.0208 27.3934 22.6066C27.9792 23.1924 28.9289 23.1924 29.5147 22.6066L39.0607 13.0607ZM0 13.5H38V10.5H0V13.5Z"
                    fill="currentColor"
                  />
                </svg>
              </div>

              {/* Down arrow - only visible on small screens */}
              <div className="absolute -bottom-8 left-1/2 block -translate-x-1/2 md:hidden">
                <svg
                  width="24"
                  height="40"
                  viewBox="0 0 24 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-blue-500 dark:text-blue-400"
                >
                  <path
                    d="M13.0607 39.0607C12.4749 39.6464 11.5251 39.6464 10.9393 39.0607L1.3934 29.5147C0.807611 28.9289 0.807611 27.9792 1.3934 27.3934C1.97919 26.8076 2.92893 26.8076 3.51472 27.3934L12 35.8787L20.4853 27.3934C21.0711 26.8076 22.0208 26.8076 22.6066 27.3934C23.1924 27.9792 23.1924 28.9289 22.6066 29.5147L13.0607 39.0607ZM13.5 0V38H10.5V0H13.5Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </div>

            {/* Enhanced LLM Workflow Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-md dark:border-slate-700 dark:bg-slate-800/50">
              <div className="mb-4 flex items-center">
                <div className="mr-4 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-8 w-8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                    />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                  Enhanced LLM workflow
                </h4>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Your existing AI tools understand your workspace architecture
                without changing your development habits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
