import { ChevronRightIcon } from '@heroicons/react/24/outline';

export const InstallNxConsole = () => (
  <div className="my-12 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-16">
    {/* VSCode */}
    <div className="not-prose group relative mx-auto flex w-full max-w-md items-center gap-4 overflow-hidden rounded-lg bg-slate-50 shadow-md transition hover:text-white dark:bg-slate-800/60">
      <div className="absolute inset-0 z-0 w-2 bg-blue-500 transition-all duration-150 group-hover:w-full dark:bg-sky-500" />
      <div className="w-2 bg-blue-500 dark:bg-sky-500" />

      <div className="z-10 flex flex-grow items-center gap-4 py-3">
        <svg
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
        >
          <title>Visual Studio Code</title>
          <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
        </svg>

        <div>
          <p>
            Install Nx Console for VSCode
            <a
              href="https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console"
              target="_blank"
              rel="noreferrer"
              className="block text-xs font-medium opacity-80"
            >
              <span className="absolute inset-0" aria-hidden="true"></span>
              The official VSCode plugin for Nx.
            </a>
          </p>
        </div>
      </div>
      <ChevronRightIcon className="mr-4 h-6 w-6 flex-shrink-0 transition-all group-hover:translate-x-3" />
    </div>
    {/* JetBrains */}
    <div className="not-prose group relative mx-auto flex w-full max-w-md items-center gap-4 overflow-hidden rounded-lg bg-slate-50 shadow-md transition hover:text-white dark:bg-slate-800/60">
      <div className="absolute inset-0 z-0 w-2 bg-blue-500 transition-all duration-150 group-hover:w-full dark:bg-sky-500" />
      <div className="w-2 bg-blue-500 dark:bg-sky-500" />

      <div className="z-10 flex flex-grow items-center gap-4 py-3">
        <svg
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          className="h-10 w-10 flex-shrink-0 rounded-sm object-cover"
        >
          <title>IntelliJ IDEA</title>
          <path d="M0 0v24h24V0zm3.723 3.111h5v1.834h-1.39v6.277h1.39v1.834h-5v-1.834h1.444V4.945H3.723zm11.055 0H17v6.5c0 .612-.055 1.111-.222 1.556-.167.444-.39.777-.723 1.11-.277.279-.666.557-1.11.668a3.933 3.933 0 0 1-1.445.278c-.778 0-1.444-.167-1.944-.445a4.81 4.81 0 0 1-1.279-1.056l1.39-1.555c.277.334.555.555.833.722.277.167.611.278.945.278.389 0 .721-.111 1-.389.221-.278.333-.667.333-1.278zM2.222 19.5h9V21h-9z" />
        </svg>

        <div>
          <p>
            Install Nx Console for JetBrains
            <a
              href="https://plugins.jetbrains.com/plugin/21060-nx-console"
              target="_blank"
              rel="noreferrer"
              className="block text-xs font-medium opacity-80"
            >
              <span className="absolute inset-0" aria-hidden="true"></span>
              Available for WebStorm, IntelliJ IDEA Ultimate and more!
            </a>
          </p>
        </div>
      </div>
      <ChevronRightIcon className="mr-4 h-6 w-6 flex-shrink-0 transition-all group-hover:translate-x-3" />
    </div>
  </div>
);
