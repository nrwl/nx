import React from 'react';
import Link from 'next/link';
import styles from './index.module.css';

export function Index() {
  return (
    <div className="w-full">
      {/*ANNOUNCEMENT BANNER*/}
      <div className="bg-blue-600">
        <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap">
            <div className="w-0 flex-1 flex items-center">
              <span className="flex p-2 rounded-lg bg-blue-800">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                  />
                </svg>
              </span>
              <p className="ml-3 font-medium text-white truncate">
                <span className="md:hidden">We announced a new nx.dev!</span>
                <span className="hidden md:inline">
                  Big news! We're excited to announce a brand new nx.dev.
                </span>
              </p>
            </div>
            <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
              <a
                href="#"
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50"
              >
                Learn more
              </a>
            </div>
            <div className="order-2 flex-shrink-0 sm:order-3 sm:ml-3">
              <button
                type="button"
                className="-mr-1 flex p-2 rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-white sm:-mr-2"
              >
                <span className="sr-only">Dismiss</span>
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/*INTRO COMPONENT*/}
      <div className="bg-gray-50">
        <div className="max-w-screen xl:max-w-screen-xl mx-auto px-5 py-5">
          <div className="mt-40">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl leading none font-extrabold tracking-tight text-gray-900 mt-10 mb-8 sm:mt-14 sm:mb-10">
              Extensible Dev Tools <br /> for Monorepos.
            </h1>
            <p className="max-w-screen-lg text-lg sm:text-2xl sm:leading-10 font-medium mb-10 sm:mb-11">
              Build full-stack applications with modern tools and reinforce best
              practices for your entire development team. Use Nx to build
              software at scale, the better way.
            </p>

            <div className="flex flex-wrap space-y-4 sm:space-y-0 sm:space-x-4 text-center">
              <Link href="/react">
                <a className="w-full sm:w-auto flex-none bg-blue-600 hover:bg-blue-700 text-white text-lg leading-6 font-semibold py-3 px-6 border border-transparen rounded focus:ring-2 focus: ring-offset-2 focus:ring-offset-white focus:ring-blue-700 focus:outline-none transition-colors duration-180">
                  Get Started
                </a>
              </Link>
              <button
                type="button"
                className="w-full sm:w-auto flex-none bg-white text-gray-400 hover:text-gray-900 font-mono leading-6 py-3 sm:px-6 border border-gray-200 rounded-xl flex items-center justify-center space-x-2 sm:space-x-4 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-gray-300 focus:outline-none transition-colors duration-180"
              >
                <span className="text-gray-900">
                  <span
                    className="hidden sm:inline sm:mr-3 text-gray-500"
                    aria-hidden="true"
                  >
                    $
                  </span>
                  npx create-nx-workspace
                </span>
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M8 16c0 1.886 0 2.828.586 3.414C9.172 20 10.114 20 12 20h4c1.886 0 2.828 0 3.414-.586C20 18.828 20 17.886 20 16v-4c0-1.886 0-2.828-.586-3.414C18.828 8 17.886 8 16 8m-8 8h4c1.886 0 2.828 0 3.414-.586C16 14.828 16 13.886 16 12V8m-8 8c-1.886 0-2.828 0-3.414-.586C4 14.828 4 13.886 4 12V8c0-1.886 0-2.828.586-3.414C5.172 4 6.114 4 8 4h4c1.886 0 2.828 0 3.414.586C16 5.172 16 6.114 16 8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-screen xl:max-w-screen-xl mx-auto px-5 py-5">
          {/*SELECTION COMPONENT*/}
          <div className="mt-32 flex sm:flex-row flex-col justify-center">
            <div className="w-full sm:w-1/2 grid grid-cols-3 gap-10 items-center">
              <a
                href="#"
                className="w-full bg-white shadow-sm hover:shadow-md transition-all ease-out duration-180 rounded py-2 px-3 space-x-1 text-base tracking-tight font-bold leading-tight text-center flex flex-col justify-center items-center px-2 py-4 space-y-4"
              >
                <svg viewBox="0 0 24 24" className="w-1/2" fill="#52C1DE">
                  <path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z" />
                </svg>
                <div className="sm:text-base md:text-sm lg:text-base">
                  React
                </div>
              </a>
              <a
                href="#"
                className="w-full bg-white shadow-sm hover:shadow-md transition-all ease-out duration-180 rounded py-2 px-3 space-x-1 text-base tracking-tight font-bold leading-tight text-center flex flex-col justify-center items-center px-2 py-4 space-y-4"
              >
                <svg viewBox="0 0 24 24" className="w-1/2" fill="#E23236">
                  <path d="M9.931 12.645h4.138l-2.07-4.908m0-7.737L.68 3.982l1.726 14.771L12 24l9.596-5.242L23.32 3.984 11.999.001zm7.064 18.31h-2.638l-1.422-3.503H8.996l-1.422 3.504h-2.64L12 2.65z" />
                </svg>
                <div className="sm:text-base md:text-sm lg:text-base">
                  Angular
                </div>
              </a>
              <a
                href="#"
                className="w-full bg-white shadow-sm hover:shadow-md transition-all ease-out duration-180 rounded py-2 px-3 space-x-1 text-base tracking-tight font-bold leading-tight text-center flex flex-col justify-center items-center px-2 py-4 space-y-4"
              >
                <svg viewBox="0 0 24 24" className="w-1/2" fill="#77AE64">
                  <path d="M11.998,24c-0.321,0-0.641-0.084-0.922-0.247l-2.936-1.737c-0.438-0.245-0.224-0.332-0.08-0.383 c0.585-0.203,0.703-0.25,1.328-0.604c0.065-0.037,0.151-0.023,0.218,0.017l2.256,1.339c0.082,0.045,0.197,0.045,0.272,0l8.795-5.076 c0.082-0.047,0.134-0.141,0.134-0.238V6.921c0-0.099-0.053-0.192-0.137-0.242l-8.791-5.072c-0.081-0.047-0.189-0.047-0.271,0 L3.075,6.68C2.99,6.729,2.936,6.825,2.936,6.921v10.15c0,0.097,0.054,0.189,0.139,0.235l2.409,1.392 c1.307,0.654,2.108-0.116,2.108-0.89V7.787c0-0.142,0.114-0.253,0.256-0.253h1.115c0.139,0,0.255,0.112,0.255,0.253v10.021 c0,1.745-0.95,2.745-2.604,2.745c-0.508,0-0.909,0-2.026-0.551L2.28,18.675c-0.57-0.329-0.922-0.945-0.922-1.604V6.921 c0-0.659,0.353-1.275,0.922-1.603l8.795-5.082c0.557-0.315,1.296-0.315,1.848,0l8.794,5.082c0.57,0.329,0.924,0.944,0.924,1.603 v10.15c0,0.659-0.354,1.273-0.924,1.604l-8.794,5.078C12.643,23.916,12.324,24,11.998,24z M19.099,13.993 c0-1.9-1.284-2.406-3.987-2.763c-2.731-0.361-3.009-0.548-3.009-1.187c0-0.528,0.235-1.233,2.258-1.233 c1.807,0,2.473,0.389,2.747,1.607c0.024,0.115,0.129,0.199,0.247,0.199h1.141c0.071,0,0.138-0.031,0.186-0.081 c0.048-0.054,0.074-0.123,0.067-0.196c-0.177-2.098-1.571-3.076-4.388-3.076c-2.508,0-4.004,1.058-4.004,2.833 c0,1.925,1.488,2.457,3.895,2.695c2.88,0.282,3.103,0.703,3.103,1.269c0,0.983-0.789,1.402-2.642,1.402 c-2.327,0-2.839-0.584-3.011-1.742c-0.02-0.124-0.126-0.215-0.253-0.215h-1.137c-0.141,0-0.254,0.112-0.254,0.253 c0,1.482,0.806,3.248,4.655,3.248C17.501,17.007,19.099,15.91,19.099,13.993z" />
                </svg>
                <div className="sm:text-base md:text-sm lg:text-base">Node</div>
              </a>
            </div>
            <div className="w-full sm:w-1/2 flex flex-col justify-between items-start sm:pl-16 sm:pb-0 pb-10 mt-8 sm:mt-0">
              <h2 className="text-xl sm:text-2xl lg:text-3xl leading-none font-extrabold text-gray-900 tracking-tight mb-4">
                Frameworks Agnostic
              </h2>
              <p className="sm:text-lg mb-6">
                Nx is a suite of powerful, extensible dev tools to help you
                architect, test, and build at any scale — integrating seamlessly
                with modern technologies and libraries while providing a robust
                CLI, caching, dependency management, and more.
              </p>
            </div>
          </div>
        </div>
        <svg viewBox="0 0 1440 320" className={styles.wave}>
          <path
            fill="white"
            fillOpacity="1"
            d="M0,64L48,74.7C96,85,192,107,288,144C384,181,480,235,576,250.7C672,267,768,245,864,208C960,171,1056,117,1152,106.7C1248,96,1344,128,1392,144L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
      </div>

      <div className="max-w-screen xl:max-w-screen-xl mx-auto px-5 py-5">
        {/*WHY NX*/}
        <div className="my-12 flex sm:flex-row flex-col justify-center">
          <div className="w-full py-6 mt-8">
            <h2 className="text-xl sm:text-2xl lg:text-3xl leading-none font-extrabold text-gray-900 tracking-tight mb-4 text-center">
              Why Nx?
            </h2>
            <p className="sm:w-1/2 sm:mx-auto text-center sm:text-lg">
              The world’s leading companies use and love Nx.
            </p>
          </div>
        </div>
        <div className="my-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="w-full flex flex-col py-8 px-6 border border-gray-100 rounded">
            <h3 className="text-lg font-semibold leading-tight mb-4">
              Complete Monorepo Support
            </h3>
            <p>
              Code is shared, Atomic changes and develop mobility, single set of
              dependencies.
            </p>
          </div>
          <div className="w-full flex flex-col py-8 px-6 border border-gray-100 rounded">
            <h3 className="text-lg font-semibold leading-tight mb-4">
              Plugins
            </h3>
            <p>
              It has support for TypeScript, React, Angular, Cypress, Jest,
              Prettier, Nest.js, Next.js, Storybook, Ionic among others.
            </p>
          </div>
          <div className="w-full flex flex-col py-8 px-6 border border-gray-100 rounded">
            <h3 className="text-lg font-semibold leading-tight mb-4">
              Computation Caching
            </h3>
            <p>A computation cache to never rebuild the same code twice.</p>
          </div>
          <div className="w-full flex flex-col py-8 px-6 border border-gray-100 rounded">
            <h3 className="text-lg font-semibold leading-tight mb-4">
              VsCode Plugins
            </h3>
            <p>
              Spend less time looking up command line arguments and more time
              shipping incredible products with NxConsole.
            </p>
          </div>
          <div className="w-full flex flex-col py-8 px-6 border border-gray-100 rounded">
            <h3 className="text-lg font-semibold leading-tight mb-4">
              Fast & Powerful CLI
            </h3>
            <p>
              Nx CLI is a command-line interface tool that helps you setup,
              develop, build, and maintain applications.
            </p>
          </div>
          <div className="w-full flex flex-col py-8 px-6 border border-gray-100 rounded">
            <h3 className="text-lg font-semibold leading-tight mb-4">
              Dependency Graph
            </h3>
            <p>Rebuilding and retesting only what is affected.</p>
          </div>
          <div className="w-full flex flex-col py-8 px-6 border border-gray-100 rounded">
            <h3 className="text-lg font-semibold leading-tight mb-4">
              Update & Migration support
            </h3>
            <p>
              Nx provides the migrate command which help you stay up to date
              with the latest version of Nx.
            </p>
          </div>
          <div className="w-full flex flex-col py-8 px-6 border border-gray-100 rounded">
            <h3 className="text-lg font-semibold leading-tight mb-4">
              Nx Devkit
            </h3>
            <p>
              Create plugins, generators and executors to extend Nx capabilities
              to fit your own needs.
            </p>
          </div>
          <div className="w-full flex flex-col py-8 px-6 border border-gray-100 rounded">
            <h3 className="text-lg font-semibold leading-tight mb-4">
              Videos Courses & Tutorials
            </h3>
            <p>
              With accessible and free online content about Nx, you can quickly
              get up and running with all of Nx's features.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-lg mx-auto px-5 py-5 space-y-14">
        {/*OTHER*/}
        <div className="flex flex-col mx-auto lg:flex-row">
          <div className="w-full lg:w-1/3 relative">
            <svg
              className="p-2 absolute inset-0 w-full h-full object-cover"
              fill="none"
              viewBox="0 0 400 300"
            >
              <path
                d="M140.84,41.84c-40.9,10.1-73.23,42-82.71,83.08-7.05,30.55-.86,62.05,46.59,73.5,102.59,24.77,213.4,16.6,226.67-32.94S319.61,41.05,261,35.79C227.55,32.8,177.83,32.7,140.84,41.84Z"
                fill="#e6e6e6"
                opacity="0.3"
              />
              <path
                d="M190.78,174.74s-7.56,3.83-4.67,8.26,9.19-4.13,9.19-4.13Z"
                fill="#f4a28c"
              />
              <path
                d="M173.5,99A4.51,4.51,0,0,1,179,93.44,66.08,66.08,0,0,1,214.79,118c1.57,2.13,3.07,4.21,4.48,6.22a31.35,31.35,0,0,1-6.89,43.14l-16.29,12.19-6.44-5.89,13.07-12.49a17.1,17.1,0,0,0-.06-24.78L177,112.12Z"
                fill="#68e1fd"
              />
              <path
                d="M173.5,99A4.51,4.51,0,0,1,179,93.44,66.08,66.08,0,0,1,214.79,118c1.57,2.13,3.07,4.21,4.48,6.22a31.35,31.35,0,0,1-6.89,43.14l-16.29,12.19-6.44-5.89,13.07-12.49a17.1,17.1,0,0,0-.06-24.78L177,112.12Z"
                fill="#fff"
                opacity="0.46"
              />
              <ellipse
                cx="206.43"
                cy="254.19"
                rx="137.87"
                ry="13.24"
                fill="#e6e6e6"
                opacity="0.45"
              />
              <path
                d="M158.4,76.91a31.55,31.55,0,0,1,2.84,8,2.55,2.55,0,0,1-2.18,2.9,5.68,5.68,0,0,1-5.72-2.25L150.23,82a4.58,4.58,0,0,1,0-5.3C152.11,73.7,157.11,74.08,158.4,76.91Z"
                fill="#f4a28c"
              />
              <polygon
                points="151.8 80.69 151.06 97.39 160.29 97.14 157.12 85.09 151.8 80.69"
                fill="#f4a28c"
              />
              <path
                d="M155.05,83s-.78-1.8-2.09-1.1-.19,3.31,1.77,2.79Z"
                fill="#f4a28c"
              />
              <path
                d="M159.73,79.85l2.07,1.27a.82.82,0,0,1,0,1.38l-1.66,1.08Z"
                fill="#f4a28c"
              />
              <path
                d="M157.87,87.85a6.06,6.06,0,0,1-3.17-1.43s.48,3,4.16,5.64Z"
                fill="#ce8172"
                opacity="0.31"
              />
              <path
                d="M151.4,85.19l-3.58-6.08s-3.31-1-1.87-3.63,3.59-1.44,4.41-4.86a3,3,0,0,1,5.49-1.32c1.21,1.77,5.51-.14,5.43,3s-4.09,4.42-5.23,4.78C151.06,78.64,157.29,84.1,151.4,85.19Z"
                fill="#24285b"
              />
              <path
                d="M178.58,245.48s1.36,3.77,4.76,4.06,4.3,3.61,1.24,4.48-11-3.07-11-3.07l.22-4.91Z"
                fill="#68e1fd"
              />
              <path
                d="M132.48,245.48s-1.36,3.77-4.76,4.06-4.3,3.61-1.24,4.48,11-3.07,11-3.07l-.22-4.91Z"
                fill="#68e1fd"
              />
              <path
                d="M173,92.5a117.92,117.92,0,0,0-44.07,9.43,17,17,0,0,0-8.58,23.25l24,47.83,44.46-2.63s8.09-26.88,6.47-57.29A21.86,21.86,0,0,0,173,92.5Z"
                fill="#68e1fd"
              />
              <path
                d="M144.34,173l-13.28,73.15h6.64l16.65-39.71a68.93,68.93,0,0,1,29.56-33.3l4.89-2.77Z"
                fill="#24285b"
              />
              <path
                d="M188.8,170.38l-6.86,75.78h-8.83s2.06-57-13.87-69.16Z"
                fill="#24285b"
              />
              <path
                d="M141.4,105.44s11.35,7.3,7.78,29.75a45,45,0,0,0,10.75,36.9l-15.59.92s-10-20.83-12.66-25.25S141.4,105.44,141.4,105.44Z"
                opacity="0.08"
              />
              <path
                d="M143.7,112.24c.05-10.17-12.66-14.86-19.46-7.3a42.1,42.1,0,0,0-10.82,23.23c-2.71,22.33.27,71.08.27,71.08h8.08s5.46-48.72,17.38-71.08C142.47,121.94,143.68,116.64,143.7,112.24Z"
                fill="#68e1fd"
              />
              <path
                d="M143.7,112.24c.05-10.17-12.66-14.86-19.46-7.3a42.1,42.1,0,0,0-10.82,23.23c-2.71,22.33.27,71.08.27,71.08h8.08s5.46-48.72,17.38-71.08C142.47,121.94,143.68,116.64,143.7,112.24Z"
                fill="#fff"
                opacity="0.46"
              />
              <path
                d="M110.81,213.33v-3.45a4.72,4.72,0,0,1,4.72-4.72H120a4.72,4.72,0,0,1,4.72,4.72v3.7"
                fill="none"
                stroke="#24285b"
                strokeMiterlimit="10"
                strokeWidth="2"
              />
              <rect
                x="91"
                y="222.03"
                width="54.56"
                height="11.89"
                fill="#ffd200"
              />
              <rect
                x="91"
                y="222.03"
                width="54.56"
                height="11.89"
                opacity="0.08"
              />
              <polygon
                points="138.9 211.97 145.56 222.03 91 222.03 97.67 211.97 138.9 211.97"
                fill="#ffd200"
              />
              <path
                d="M115.09,199.25s-2.42,8.05.77,8.05,7,1.53,4.59-8.05Z"
                fill="#f4a28c"
              />
              <rect
                x="323.84"
                y="199.8"
                width="3.76"
                height="51.46"
                transform="translate(73.05 -79.61) rotate(15.67)"
                fill="#e6e6e6"
              />
              <path
                d="M336.26,203.17a3.61,3.61,0,0,1-.85-.11l-6.07-1.71a3.14,3.14,0,0,1-2.17-3.86l1.23-4.37a3.13,3.13,0,0,1,3.86-2.17l6.07,1.7a3.14,3.14,0,0,1,1.89,1.49,3.09,3.09,0,0,1,.28,2.38l-1.22,4.37A3.14,3.14,0,0,1,336.26,203.17Zm-.32-2a1.18,1.18,0,0,0,1.46-.82l1.23-4.37a1.19,1.19,0,0,0-.82-1.46l-6.08-1.7a1.17,1.17,0,0,0-1.45.82L329.05,198a1.17,1.17,0,0,0,.82,1.45Z"
                fill="#c9c9c9"
              />
              <path
                d="M327.55,253.23l3-10.78-18-5.06-3.16,11.27a9.33,9.33,0,0,0-.12,4.57Z"
                fill="#c9c9c9"
              />
              <rect
                x="229.36"
                y="174.47"
                width="8.23"
                height="78.23"
                fill="#68e1fd"
              />
              <rect
                x="273.83"
                y="174.47"
                width="8.23"
                height="78.23"
                fill="#68e1fd"
              />
              <rect
                x="229.36"
                y="174.47"
                width="8.23"
                height="78.23"
                opacity="0.08"
              />
              <rect
                x="273.83"
                y="174.47"
                width="8.23"
                height="78.23"
                opacity="0.08"
              />
              <rect
                x="219.62"
                y="184.18"
                width="72.21"
                height="25.47"
                fill="#68e1fd"
              />
              <polygon
                points="223.28 184.18 231.91 209.65 243.85 209.65 234.04 184.18 223.28 184.18"
                fill="#24285b"
              />
              <polygon
                points="245.38 184.18 254.01 209.65 265.95 209.65 256.14 184.18 245.38 184.18"
                fill="#24285b"
              />
              <polygon
                points="267.42 184.18 276.04 209.65 287.98 209.65 278.17 184.18 267.42 184.18"
                fill="#24285b"
              />
              <rect
                x="219.62"
                y="219.3"
                width="72.21"
                height="11.94"
                fill="#68e1fd"
              />
              <polygon
                points="272.41 184.18 291.83 202.92 291.83 194 272.41 184.18"
                opacity="0.08"
              />
              <path
                d="M145,75.41l17.29-2.34a.68.68,0,0,0,.29-1.23l-.74-.51a4,4,0,0,1-1.67-2.43c-.65-2.69-2.58-8.11-7.76-8.33-6.62-.29-13.15,4.67-9.19,13.83A1.69,1.69,0,0,0,145,75.41Z"
                fill="#ffd200"
              />
              <path
                d="M143.5,69.37a7.53,7.53,0,0,1,2.92-6.1.54.54,0,0,1,.8.66,13.61,13.61,0,0,0-1.36,5.5,1.17,1.17,0,0,1-1,1.12h0A1.18,1.18,0,0,1,143.5,69.37Z"
                fill="#fff"
                opacity="0.31"
              />
              <path
                d="M305.81,113.65A9.23,9.23,0,0,0,295,104.5a12.49,12.49,0,0,0-11-6.58l-.46,0a14.85,14.85,0,1,0-28.77,0l-.46,0a12.5,12.5,0,0,0,0,25h43.4v-.08A9.27,9.27,0,0,0,305.81,113.65Z"
                fill="#e6e6e6"
              />
              <path
                d="M68.61,83.83A6.87,6.87,0,0,1,75.48,77a8,8,0,0,1,1.11.09,9.25,9.25,0,0,1,8.16-4.87h.34a10.6,10.6,0,0,1-.34-2.66,11,11,0,1,1,21.65,2.66h.34a9.26,9.26,0,1,1,0,18.52H74.59v-.06A6.88,6.88,0,0,1,68.61,83.83Z"
                fill="#e6e6e6"
              />
              <path
                d="M144,174.74s5.37-28.54,5.37-44.31c0-23.31-8.44-33.26-8.44-33.26l3.5-1.12s7.32,11.93,19.35,9.39c11.2-2.35,8.36-13.22,8.31-13.38h3.24s10.44,8.54,12.89,22.29c4.16,23.3.55,56,.55,56Z"
                fill="#24285b"
              />
              <rect
                x="140.56"
                y="170.38"
                width="47.69"
                height="6.04"
                fill="#c9c9c9"
              />
              <rect
                x="138.56"
                y="167.24"
                width="9.67"
                height="14.16"
                rx="2.11"
                fill="#ffd200"
              />
              <rect
                x="138.56"
                y="167.24"
                width="9.67"
                height="6.81"
                rx="2.11"
                fill="#fff"
                opacity="0.46"
              />
              <circle cx="143.4" cy="170.6" r="1.35" fill="#24285b" />
              <rect
                x="149.97"
                y="167.24"
                width="9.67"
                height="14.16"
                rx="2.11"
                fill="#ffd200"
              />
              <rect
                x="149.97"
                y="167.24"
                width="9.67"
                height="6.81"
                rx="2.11"
                fill="#fff"
                opacity="0.46"
              />
              <circle cx="154.8" cy="170.6" r="1.35" fill="#24285b" />
              <rect
                x="180.4"
                y="167.24"
                width="9.67"
                height="14.16"
                rx="2.11"
                fill="#ffd200"
              />
              <rect
                x="180.4"
                y="167.24"
                width="9.67"
                height="6.81"
                rx="2.11"
                fill="#fff"
                opacity="0.46"
              />
              <circle cx="185.23" cy="170.6" r="1.35" fill="#24285b" />
              <path
                d="M214.55,248.79s3.68-5.3-1.82-6.76,1.33-8.6-3.79-9.54-4.26,6.61-4.26,6.61-3.53-3-6-.48,1,5.36,1,5.36-4.93,1.7-1.86,4.81Z"
                fill="#e6e6e6"
              />
              <path
                d="M207.16,249.49s2.34-4,5.78-3.51a3.21,3.21,0,0,1,3.08,3.51Z"
                fill="#c9c9c9"
              />
              <path
                d="M184.79,132.76s-21.33,1.37-27.77,0l-.87,17.47s21.46,3,27.73.72Z"
                fill="#fff"
                opacity="0.2"
              />
            </svg>
          </div>
          <div className="flex flex-col w-full p-6 lg:w-2/3 md:p-8 lg:p-12">
            <h2 className="text-3xl font-semibold leading">
              Develop Efficiently at Scale with Nx
            </h2>
            <p className="mt-4 mb-8">
              Nx helps scale your development from one team building one
              application to many teams building multiple frontend and backend
              applications all in the same workspace. When using Nx, developers
              have a holistic dev experience powered by an advanced CLI (with
              editor plugins), capabilities for controlled code sharing and
              consistent code generation.
            </p>
          </div>
        </div>
        <div className="flex flex-col mx-auto lg:flex-row">
          <div className="flex flex-col w-full p-6 lg:w-2/3 md:p-8 lg:p-12">
            <h2 className="text-3xl font-semibold leading">
              Use Intelligent Build System
            </h2>
            <p className="mt-4">
              Nx is smart. It analyzes your workspace and figures out what can
              be affected by every code change. That's why Nx doesn't rebuild
              and retest everything on every commit--it only rebuilds what is
              necessary.
            </p>
          </div>
          <div className="w-full lg:w-1/3 relative">
            <svg
              className="p-2 absolute inset-0 w-full h-full object-cover"
              fill="none"
              viewBox="0 0 400 300"
            >
              <rect
                x="216.37"
                y="72.07"
                width="133.65"
                height="97.51"
                fill="#e6e6e6"
              />
              <rect
                x="223.21"
                y="129.48"
                width="25.36"
                height="28.16"
                fill="#c1c1c1"
              />
              <rect
                x="171.47"
                y="28.32"
                width="76.7"
                height="95.87"
                transform="translate(419.64 152.51) rotate(-180)"
                fill="#24285b"
              />
              <path
                d="M155.07,189.38l20.43-33.66s7.63,0,8.89-3.09c.79-1.92-3.95-2.43-7.61-2.54a9,9,0,0,0-6.64,2.71L145,178.57S140.05,194,155.07,189.38Z"
                fill="#f4a28c"
              />
              <path
                d="M155.07,189.38l20.43-33.66s7.63,0,8.89-3.09c.79-1.92-3.95-2.43-7.61-2.54a9,9,0,0,0-6.64,2.71L145,178.57S140.05,194,155.07,189.38Z"
                opacity="0.08"
              />
              <path
                d="M183.19,204.7s7.36,6.94-2.18,6.66S175,203.66,183.19,204.7Z"
                fill="#68e1fd"
              />
              <ellipse
                cx="155.56"
                cy="248.25"
                rx="105.44"
                ry="9.73"
                fill="#e6e6e6"
                opacity="0.45"
              />
              <path
                d="M124.68,116.85a29,29,0,0,1,.75,7.68,2.34,2.34,0,0,1-2.58,2.08,5.16,5.16,0,0,1-4.55-3.26l-2-3.81a4.17,4.17,0,0,1,1.17-4.68C119.83,112.62,124.17,114.06,124.68,116.85Z"
                fill="#f4a28c"
              />
              <polygon
                points="116.72 121.9 118.15 137.06 126.45 135.68 122.08 125.2 116.72 121.9"
                fill="#f4a28c"
              />
              <path
                d="M120.37,121.5s-.29-1.77-1.6-1.43-.91,2.88.94,2.85Z"
                fill="#f4a28c"
              />
              <path
                d="M125.21,119.73l1.54,1.58a.75.75,0,0,1-.29,1.23l-1.71.59Z"
                fill="#f4a28c"
              />
              <path
                d="M155.74,192.29s28.39-7.2,32.09,5.35S148.12,209,148.12,209l-9.87-7.81Z"
                fill="#24285b"
              />
              <path
                d="M126.45,135.68s16.53,1.68,28.05,14.85c6.84,7.82,4.25,14.33,1,18.33a13.19,13.19,0,0,0-2.15,12.3l3.42,10.67S138.51,203.61,127,202.37,79.06,137.49,126.45,135.68Z"
                fill="#68e1fd"
              />
              <path
                d="M103.94,149.06a28.65,28.65,0,0,0-.94,12.33c1.11,6.05,6.84,46.31,44.74,35.44l9-5-9.6-8.11-18.38-19.23-8-15.43Z"
                opacity="0.08"
              />
              <path
                d="M116.93,176.25c-8.13-24.61-44.41-20.58-47.51,5.16-3.2,26.57.43,63.23,43.2,68,68,7.56,78.73-23.16,69.13-39.34s-57.34-7.68-64.47-32.65C117.17,177,117.05,176.63,116.93,176.25Z"
                fill="#ffd200"
              />
              <path
                d="M173,190.13s9.48,2.29,10.17-3.74l-10.36-.55Z"
                fill="#f4a28c"
              />
              <path
                d="M115.38,149.75a7.19,7.19,0,0,1,11-6.23c3.25,2.14,6.45,6.57,8.39,15.27,3.77,17,13.18,24.31,38.22,26.5v4.84S116.39,204.52,115.38,149.75Z"
                fill="#f4a28c"
              />
              <rect
                x="166.93"
                y="182.57"
                width="29.35"
                height="4.22"
                fill="#ffd200"
              />
              <polygon
                points="192.42 184.68 201.91 153.54 204.63 154.16 196.28 186.79 192.42 184.68"
                fill="#ffd200"
              />
              <path
                d="M93,214.56c-4.79-4.37-12.28.41-10.21,6.55,2.92,8.68,9.66,17.2,24.45,19.71,33.23,5.66,30-6.64,27.85-12C133.38,224.44,111.37,231.27,93,214.56Z"
                fill="#fff"
                opacity="0.45"
              />
              <path
                d="M117.26,127.57s-9.46-4.13-6.05-11.84,12.78-5.45,12.43-.71c0,0-4.48,1.26-4.45,4.11S122.11,125.33,117.26,127.57Z"
                fill="#24285b"
              />
              <circle cx="108.31" cy="114.94" r="4.26" fill="#24285b" />
              <path
                d="M211.82,83.42a17.09,17.09,0,1,1,17.09-17.09A17.11,17.11,0,0,1,211.82,83.42Zm0-29.58A12.49,12.49,0,1,0,224.3,66.33,12.51,12.51,0,0,0,211.82,53.84Z"
                fill="#fff"
              />
              <path
                d="M228.91,66.33H224.3a12.5,12.5,0,0,0-12.48-12.49v-4.6A17.11,17.11,0,0,1,228.91,66.33Z"
                fill="#68e1fd"
              />
              <path
                d="M211.82,83.42v-4.6A12.5,12.5,0,0,0,224.3,66.33h4.61A17.11,17.11,0,0,1,211.82,83.42Z"
                fill="#ffd200"
              />
              <rect
                x="196.16"
                y="93.38"
                width="30.26"
                height="4.85"
                fill="#fff"
              />
              <rect
                x="196.16"
                y="104.36"
                width="30.26"
                height="4.85"
                fill="#fff"
                opacity="0.21"
              />
              <rect
                x="269.32"
                y="105.92"
                width="12.69"
                height="8.68"
                fill="#c1c1c1"
              />
              <rect
                x="288.55"
                y="100.19"
                width="12.69"
                height="14.4"
                fill="#c1c1c1"
              />
              <rect
                x="307.47"
                y="90.42"
                width="12.69"
                height="24.17"
                fill="#c1c1c1"
              />
              <rect
                x="263.89"
                y="114.03"
                width="62.64"
                height="2.31"
                fill="#878787"
              />
              <circle cx="180.89" cy="37.3" r="2.49" fill="#fff" />
              <circle cx="188.15" cy="37.3" r="2.49" fill="#68e1fd" />
              <circle cx="195.48" cy="37.3" r="2.49" fill="#ffd200" />
              <rect
                x="255.89"
                y="129.48"
                width="78.64"
                height="28.16"
                fill="#c1c1c1"
                opacity="0.31"
              />
              <polygon
                points="275.22 101.81 274.36 101.3 283.06 86.69 294.78 95.69 306.55 78.29 314.18 86.23 313.46 86.92 306.69 79.88 295.01 97.13 283.34 88.17 275.22 101.81"
                fill="#878787"
              />
              <path
                d="M212.07,238.52s-6.35-1.73-7.73-7.64c0,0,9.84-2,10.12,8.17Z"
                fill="#68e1fd"
                opacity="0.58"
              />
              <path
                d="M212.85,237.89s-4.44-7-.54-13.57c0,0,7.49,4.75,4.16,13.59Z"
                fill="#68e1fd"
                opacity="0.73"
              />
              <path
                d="M214,237.9s2.34-7.41,9.43-8.81c0,0,1.33,4.81-4.59,8.83Z"
                fill="#68e1fd"
              />
              <polygon
                points="209.38 237.73 210.67 246.54 218.78 246.57 219.97 237.78 209.38 237.73"
                fill="#24285b"
              />
              <rect
                x="290.96"
                y="182.54"
                width="51.96"
                height="23.65"
                fill="#24285b"
              />
              <polygon
                points="327.55 198.78 337.98 198.78 332.76 188.98 327.55 198.78"
                fill="#68e1fd"
              />
              <rect
                x="301.85"
                y="189.38"
                width="20.53"
                height="3.11"
                rx="1.28"
                fill="#fff"
              />
              <rect
                x="301.85"
                y="195.29"
                width="20.53"
                height="3.11"
                rx="1.28"
                fill="#fff"
                opacity="0.15"
              />
              <rect
                x="224.72"
                y="182.54"
                width="51.96"
                height="23.65"
                fill="#24285b"
              />
              <polygon
                points="261.32 198.78 271.74 198.78 266.53 188.98 261.32 198.78"
                fill="#ffd200"
              />
              <rect
                x="235.61"
                y="189.38"
                width="20.53"
                height="3.11"
                rx="1.28"
                fill="#fff"
              />
              <rect
                x="235.61"
                y="195.29"
                width="20.53"
                height="3.11"
                rx="1.28"
                fill="#fff"
                opacity="0.15"
              />
              <path
                d="M93.12,130.63h0c-1,0-2,0-3-.1a.49.49,0,0,1-.47-.52.46.46,0,0,1,.52-.47c1,0,2,.07,3,.09a.5.5,0,0,1,.5.5A.51.51,0,0,1,93.12,130.63Zm-12.91-1.28h-.1c-1-.21-2-.44-3-.69a.5.5,0,0,1-.36-.61.52.52,0,0,1,.62-.36c.92.25,1.89.48,2.88.68a.5.5,0,0,1-.09,1Zm-12.15-4.43a.59.59,0,0,1-.26-.07,30.26,30.26,0,0,1-2.54-1.69.5.5,0,1,1,.6-.8A28.94,28.94,0,0,0,68.31,124a.5.5,0,0,1-.25.93Zm-9-9.12a.49.49,0,0,1-.44-.26,21.24,21.24,0,0,1-1.26-2.79.5.5,0,1,1,.93-.35,22.07,22.07,0,0,0,1.21,2.67.51.51,0,0,1-.2.68A.52.52,0,0,1,59,115.8ZM56.3,103.26h0a.5.5,0,0,1-.48-.52,28.82,28.82,0,0,1,.26-3,.5.5,0,1,1,1,.13c-.13,1-.22,2-.25,2.94A.5.5,0,0,1,56.3,103.26Zm2.94-12.59a.43.43,0,0,1-.19,0,.5.5,0,0,1-.27-.66c.39-.92.82-1.84,1.28-2.75a.51.51,0,0,1,.67-.22.5.5,0,0,1,.22.68c-.45.88-.87,1.79-1.25,2.69A.49.49,0,0,1,59.24,90.67Zm6.85-11a.5.5,0,0,1-.35-.86,19.48,19.48,0,0,1,2.36-2,.51.51,0,0,1,.7.11.5.5,0,0,1-.12.7,18.33,18.33,0,0,0-2.24,1.87A.54.54,0,0,1,66.09,79.7Zm11.25-6.3a.5.5,0,0,1-.47-.33.5.5,0,0,1,.31-.64c.91-.32,1.88-.62,2.88-.91a.5.5,0,1,1,.28,1c-1,.28-1.94.58-2.84.9ZM90,70.3a.5.5,0,0,1-.09-1c1-.17,2-.32,3-.47a.5.5,0,1,1,.15,1c-1,.14-2,.3-3,.47Zm67.88-.94h-.05s-1.07-.11-3-.27a.5.5,0,1,1,.08-1c1.92.15,3,.26,3,.26a.5.5,0,0,1,.45.55A.51.51,0,0,1,157.84,69.36Zm-55-.66a.5.5,0,0,1,0-1l3-.23a.51.51,0,0,1,.53.47.5.5,0,0,1-.46.53l-3,.23Zm42-.27h0l-3-.15a.5.5,0,1,1,0-1l3,.14a.5.5,0,0,1,.47.53A.49.49,0,0,1,144.86,68.43Zm-29-.44a.5.5,0,0,1,0-1l3-.07a.5.5,0,1,1,0,1l-3,.07Zm16,0h0l-3,0a.5.5,0,0,1-.5-.5.51.51,0,0,1,.51-.5l3,0a.5.5,0,0,1,0,1Z"
                fill="#e6e6e6"
              />
            </svg>
          </div>
        </div>
        <div className="flex flex-col mx-auto lg:flex-row">
          <div className="w-full lg:w-1/3 relative">
            <svg
              className="p-2 absolute inset-0 w-full h-full object-cover"
              fill="none"
              viewBox="0 0 400 300"
            >
              <ellipse
                cx="201.81"
                cy="227.2"
                rx="117.91"
                ry="17.07"
                fill="#e6e6e6"
                opacity="0.45"
              />
              <rect
                x="56.82"
                y="47.16"
                width="72.3"
                height="79.73"
                transform="translate(185.94 174.06) rotate(-180)"
                fill="#e6e6e6"
              />
              <circle cx="64.67" cy="55.3" r="2.77" fill="#ffd200" />
              <circle cx="72.47" cy="55.3" r="2.77" fill="#68e1fd" />
              <circle cx="79.94" cy="55.3" r="2.77" fill="#24285b" />
              <circle cx="92.97" cy="83.99" r="15.42" fill="#24285b" />
              <path
                d="M93,84l14.26-5.86s-2.72-9.23-13.89-9.55Z"
                fill="#ffd200"
              />
              <path
                d="M93,84l14.2,6a15.36,15.36,0,0,0,.06-11.89Z"
                fill="#fff"
              />
              <rect
                x="78.3"
                y="112.2"
                width="29.44"
                height="5.78"
                fill="#878787"
                opacity="0.19"
              />
              <path
                d="M109.59,211.63s-8.85-2.42-10.78-10.66c0,0,13.71-2.77,14.1,11.38Z"
                fill="#68e1fd"
                opacity="0.58"
              />
              <path
                d="M110.67,210.75s-6.18-9.78-.74-18.92c0,0,10.43,6.63,5.79,18.94Z"
                fill="#68e1fd"
                opacity="0.73"
              />
              <path
                d="M112.27,210.75s3.26-10.32,13.14-12.27c0,0,1.85,6.7-6.4,12.3Z"
                fill="#68e1fd"
              />
              <polygon
                points="105.85 210.52 107.64 222.79 118.94 222.84 120.61 210.58 105.85 210.52"
                fill="#24285b"
              />
              <path
                d="M148.42,109.34V215.76c0,8,23.73,14.55,53,14.55s53-6.51,53-14.55V109.34Z"
                fill="#68e1fd"
              />
              <ellipse
                cx="201.43"
                cy="109.34"
                rx="53"
                ry="14.55"
                fill="#68e1fd"
              />
              <ellipse
                cx="201.43"
                cy="109.34"
                rx="53"
                ry="14.55"
                fill="#fff"
                opacity="0.47"
              />
              <path
                d="M148.42,146.85s47.9,17.94,106,0V184s-48.92,21.79-106,0Z"
                opacity="0.09"
              />
              <rect
                x="233.6"
                y="80.02"
                width="99.57"
                height="53.99"
                fill="#24285b"
              />
              <path
                d="M155.72,132.62s10,6.89,34.73,6.64"
                fill="none"
                stroke="#fff"
                strokeMiterlimit="10"
              />
              <path
                d="M155.72,167s10,6.9,34.73,6.64"
                fill="none"
                stroke="#fff"
                strokeMiterlimit="10"
              />
              <path
                d="M155.72,204.45s10,6.9,34.73,6.64"
                fill="none"
                stroke="#fff"
                strokeMiterlimit="10"
              />
              <path
                d="M320.06,109.78l-3.32-2.59a12.46,12.46,0,0,0,0-2.73l3.32-2.6a1.62,1.62,0,0,0,.4-2.07l-3.46-6a1.65,1.65,0,0,0-2-.72l-3.91,1.58a14.13,14.13,0,0,0-2.35-1.37l-.6-4.15a1.6,1.6,0,0,0-1.6-1.39h-6.92A1.6,1.6,0,0,0,298,89.13l-.61,4.17a14,14,0,0,0-2.34,1.37l-3.93-1.58a1.6,1.6,0,0,0-2,.71l-3.46,6a1.62,1.62,0,0,0,.39,2.09l3.32,2.59a12.46,12.46,0,0,0,0,2.73l-3.32,2.6a1.62,1.62,0,0,0-.39,2.07l3.45,6a1.64,1.64,0,0,0,2,.72l3.91-1.58a14.55,14.55,0,0,0,2.35,1.37l.61,4.15a1.59,1.59,0,0,0,1.59,1.39h6.92a1.6,1.6,0,0,0,1.59-1.37l.61-4.17a14,14,0,0,0,2.34-1.37l3.93,1.58a1.61,1.61,0,0,0,2-.71l3.46-6A1.63,1.63,0,0,0,320.06,109.78Zm-17,3.57a7.53,7.53,0,1,1,7.52-7.53A7.53,7.53,0,0,1,303.08,113.35Z"
                fill="#ffd200"
              />
              <rect
                x="246.53"
                y="98.57"
                width="27.23"
                height="5.45"
                fill="#fff"
              />
              <rect
                x="246.53"
                y="110.02"
                width="27.23"
                height="5.45"
                fill="#fff"
                opacity="0.29"
              />
            </svg>
          </div>
          <div className="flex flex-col w-full p-6 lg:w-2/3 md:p-8 lg:p-12">
            <h2 className="text-3xl font-semibold leading">
              Smart Distributed Caching
            </h2>
            <p className="mt-4 mb-8">
              Nx also uses a distributed computation cache. If someone has
              already built or tested similar code, Nx will use their results to
              speed up the command for everyone else instead of rebuilding or
              retesting the code from scratch. This, in combination with Nx’s
              support for distributed and incremental builds, can help teams see
              up to 10x reduction in build and test times.
            </p>
          </div>
        </div>
        <div className="flex flex-col mx-auto lg:flex-row">
          <div className="flex flex-col w-full p-6 lg:w-2/3 md:p-8 lg:p-12">
            <h2 className="text-3xl font-semibold leading-none">
              Use Modern Tools
            </h2>
            <p className="mt-4 mb-8">
              Nx is an open platform with plugins for many modern tools and
              frameworks. It has support for TypeScript, React, Angular,
              Cypress, Jest, Prettier, Nest.js, Next.js, Storybook, Ionic among
              others. With Nx, you get a consistent dev experience regardless of
              the tools used.
            </p>
          </div>
          <div className="w-full lg:w-1/3 relative">
            <svg
              className="p-2 absolute inset-0 w-full h-full object-cover"
              fill="none"
              viewBox="0 0 400 300"
            >
              <path
                d="M264.78,118.27s-3.84,17.51-24.17,19.49-48.75-45.52-48.75-45.52,24.53,2.49,33.47,14.49S243,124.33,257,115Z"
                fill="#68e1fd"
              />
              <path
                d="M264.78,118.27s-3.84,17.51-24.17,19.49-48.75-45.52-48.75-45.52,24.53,2.49,33.47,14.49S243,124.33,257,115Z"
                fill="#fff"
                opacity="0.2"
              />
              <ellipse
                cx="205.66"
                cy="258.99"
                rx="100.75"
                ry="13.95"
                fill="#e6e6e6"
                opacity="0.45"
              />
              <path
                d="M190.59,249.22s-1.19,4,1.47,6.33,1.36,5.68-1.73,4.51-7.27-9.33-7.27-9.33l3.23-4Z"
                fill="#68e1fd"
              />
              <path
                d="M226.33,246.83s-.67,4.11,2.27,6.09,2.08,5.45-1.14,4.69-8.4-8.32-8.4-8.32l2.68-4.35Z"
                fill="#68e1fd"
              />
              <path
                d="M168.49,61.47s-.39,7.7-2.38,12.59A3.88,3.88,0,0,1,161,76.18c-2.44-1-5.45-3.15-5.74-7.3l-1.36-7A6.92,6.92,0,0,1,158,55C162.72,52.48,169,56.79,168.49,61.47Z"
                fill="#f4a28c"
              />
              <polygon
                points="154.33 67.85 157.85 88.84 172.09 89.5 163.81 73.1 154.33 67.85"
                fill="#f4a28c"
              />
              <path
                d="M166.54,61.52a30.58,30.58,0,0,1-7-1.51,6.42,6.42,0,0,1-1,7,5.12,5.12,0,0,1-3.13,1.82,2.74,2.74,0,0,1-3-3.17l1.09-7.25A7.87,7.87,0,0,1,158.45,52a27.58,27.58,0,0,1,3.5-1.15c3-.74,6.86,1.72,9.66.16a1.86,1.86,0,0,1,2.75,1.61c0,3-1.15,7.68-5.42,8.75A7.15,7.15,0,0,1,166.54,61.52Z"
                fill="#24285b"
              />
              <path
                d="M159.46,66.88s.35-2.94-1.89-3-2.77,4.17.18,5Z"
                fill="#f4a28c"
              />
              <path
                d="M168,66.31l1.72,3.24a1.23,1.23,0,0,1-1,1.81l-3,.15Z"
                fill="#f4a28c"
              />
              <path
                d="M165,75.56a9.43,9.43,0,0,1-4.93-1s.41,5.52,7.31,5.74Z"
                fill="#ce8172"
                opacity="0.31"
              />
              <path
                d="M221,180.17l10.43,16.24a33.23,33.23,0,0,1,3.36,29.08l-7.55,21.27-7.83-1.7,2.2-21.16a19.67,19.67,0,0,0-7-17.15L198.75,193.5l12-13.33Z"
                fill="#24285b"
              />
              <path
                d="M131.78,107.78a21.55,21.55,0,0,1,22.11-20.66c14.4.35,35.63,2.22,48.94,9.61,21.66,12,18,80.74,18,80.74L174.36,188.4S130.46,145,131.78,107.78Z"
                fill="#68e1fd"
              />
              <path
                d="M152.41,99.61s19.68,8.6,28,43c8.22,34.08,39.07,13.8,39.07,13.8L219,178.12,174.36,188.4l-9.68-10.65S135.43,145.54,152.41,99.61Z"
                opacity="0.08"
              />
              <path
                d="M174.36,188.4,185.23,205a27,27,0,0,1,3.49,21.79l-5.61,20.82,8.75,2,11.81-21.49a33.52,33.52,0,0,0,1.61-29l-2.51-6.07,14-14.65Z"
                fill="#24285b"
              />
              <path
                d="M251.55,155.29l16.56-13.5-16.88-20.71a14.67,14.67,0,1,0-11.76-14.43L222.58,85.93l-55.85,45.54,45.53,55.85,16.56-13.5a14.66,14.66,0,0,1,22.73-18.53Z"
                fill="#ffd200"
              />
              <path
                d="M104.43,154.14,94,138.14l-20,13.09A13.13,13.13,0,1,0,60,160.36l-20,13.1,35.33,54,54-35.33-10.47-16a13.13,13.13,0,1,1-14.38-22Z"
                fill="#e6e6e6"
              />
              <path
                d="M347.83,145.31a13.24,13.24,0,1,0-14.78-8l-21.21-11.52-9.23,17a13.16,13.16,0,1,1-12.54,23.1L280.78,183,338,214l9.21-17a13.25,13.25,0,1,1,12.64-23.28l9.21-17Z"
                fill="#c9c9c9"
              />
              <path
                d="M187,156.39l40.39.93s-5.07,7.6,1.39,16.5l-16.56,13.5Z"
                opacity="0.08"
              />
              <path
                d="M130.78,105c-2.12,10.22-3.91,30.11,8.81,59.62a21.75,21.75,0,0,0,19.85,13.07l59.55.41.45-9.13-54.91-9.14s2.2-46.54-13.19-61.36C144.44,91.84,132.72,95.63,130.78,105Z"
                fill="#68e1fd"
              />
              <path
                d="M130.78,105c-2.12,10.22-3.91,30.11,8.81,59.62a21.75,21.75,0,0,0,19.85,13.07l59.55.41.45-9.13-54.91-9.14s2.2-46.54-13.19-61.36C144.44,91.84,132.72,95.63,130.78,105Z"
                fill="#fff"
                opacity="0.2"
              />
              <path
                d="M219.06,176.75s7.21,3.65,10.88.15.17-6,0-9.67a2.34,2.34,0,0,0-1.62-2.4,3,3,0,0,0-3.48,1.4c-1,1.62-2.87,4.13-5.4,3.71Z"
                fill="#f4a28c"
              />
              <path
                d="M267.5,112.84s-4.43-5.55-9.33,0S263.41,126.45,267.5,112.84Z"
                fill="#f4a28c"
              />
              <path
                d="M164.53,159.85a75.35,75.35,0,0,0-10.37,0,37.16,37.16,0,0,1,10.37-3.46Z"
                opacity="0.08"
              />
              <rect
                x="132.76"
                y="32.74"
                width="5.32"
                height="5.32"
                transform="translate(231.32 137.35) rotate(-147.9)"
                fill="#c9c9c9"
              />
              <rect
                x="233.05"
                y="36.28"
                width="5.57"
                height="5.57"
                transform="translate(374.98 233.45) rotate(-135)"
                fill="#e6e6e6"
              />
              <rect
                x="81.2"
                y="98.41"
                width="9.07"
                height="9.07"
                transform="translate(4.45 209.43) rotate(-102.86)"
                fill="#e6e6e6"
              />
              <rect
                x="299.54"
                y="84.96"
                width="9.07"
                height="9.07"
                transform="translate(214.58 393.57) rotate(-90)"
                fill="#c9c9c9"
              />
            </svg>
          </div>
        </div>
        <div className="flex flex-col mx-auto lg:flex-row">
          <div className="w-full lg:w-1/3 relative">
            <svg
              className="p-2 absolute inset-0 w-full h-full object-cover"
              fill="none"
              viewBox="0 0 400 300"
            >
              <path
                d="M298.5,56.38c35.23,12.07,68.79,45.16,69.81,87.88s-10.65,86.24-74.84,103.11C233.18,263.22,90,269,51.89,215.85c-36-50.06-24.55-131.33,38.33-157.32C134.29,40.31,229.69,32.83,298.5,56.38Z"
                fill="#e6e6e6"
                opacity="0.3"
              />
              <path
                d="M191.45,76.66s-19.24,19.73-30.29,36.47-42.33-24.86-42.33-24.86l-6.16,7.3s25.48,52.53,57.59,39.34S223,83.87,191.45,76.66Z"
                fill="#68e1fd"
              />
              <path
                d="M191.45,76.66s-19.24,19.73-30.29,36.47-42.33-24.86-42.33-24.86l-6.16,7.3s25.48,52.53,57.59,39.34S223,83.87,191.45,76.66Z"
                fill="#fff"
                opacity="0.46"
              />
              <path
                d="M233,75.59s-21.32-14.51-44.47,3.22,6.83,80.31,6.83,80.31l43.32,1.44S291.75,113.32,233,75.59Z"
                fill="#68e1fd"
              />
              <path
                d="M227.67,90.42s-19.17,8.88-6.88,27.45.09,37.78-26.7,38.55l29.23,7.31,33.21-18.57-3.95-25.09Z"
                opacity="0.08"
              />
              <path
                d="M205.75,49.66s-.29,6,.87,10a3,3,0,0,0,3.78,2,6.68,6.68,0,0,0,5-5.23l1.6-5.34a5.39,5.39,0,0,0-2.6-5.68C210.93,43.11,205.74,46,205.75,49.66Z"
                fill="#f4a28c"
              />
              <polygon
                points="216.74 52.08 220.6 71.46 209.76 72.82 211.31 58.17 216.74 52.08"
                fill="#f4a28c"
              />
              <path
                d="M207.25,49.85a23.42,23.42,0,0,0,5.54-.64,5,5,0,0,0,.21,5.52,4.11,4.11,0,0,0,5,1.44l-.4-7.74a6.13,6.13,0,0,0-3.32-5.35,22.27,22.27,0,0,0-2.63-1.16c-2.27-.81-5.47.8-7.53-.63a1.46,1.46,0,0,0-2.27,1.05c-.25,2.36.31,6,3.54,7.22A5.55,5.55,0,0,0,207.25,49.85Z"
                fill="#24285b"
              />
              <path
                d="M212.35,54.57s0-2.32,1.71-2.21,1.83,3.47-.53,3.87Z"
                fill="#f4a28c"
              />
              <path
                d="M205.76,53.47l-1.59,2.38a1,1,0,0,0,.66,1.49l2.32.35Z"
                fill="#f4a28c"
              />
              <path
                d="M210.84,61.37a7.18,7.18,0,0,0,3.44-2.24s0,3.61-3.84,7.33Z"
                fill="#ce8172"
                opacity="0.31"
              />
              <path
                d="M226,99.22c-2-12.34,13.09-20,22-11.19,6.32,6.21,12.12,15.06,12.93,26.94,1.89,27.44-6,51.83-22.34,48.45s-40.7-38-40.7-38l5.34-5.42s23.86,24.61,34.56,21.15C245.39,138.69,229.17,118.55,226,99.22Z"
                fill="#68e1fd"
              />
              <path
                d="M226,99.22c-2-12.34,13.09-20,22-11.19,6.32,6.21,12.12,15.06,12.93,26.94,1.89,27.44-6,51.83-22.34,48.45s-40.7-38-40.7-38l5.34-5.42s23.86,24.61,34.56,21.15C245.39,138.69,229.17,118.55,226,99.22Z"
                fill="#fff"
                opacity="0.46"
              />
              <path
                d="M203.23,120s-3.08-13.36-5.34-13.15,0,8.43,0,8.43-3.53-6.75-5.41-7,2.93,8.81,2.93,8.81-5.87-5.31-7.76-3.71,7.79,7.7,7.79,7.7-1.16,4.4,2.45,4.3Z"
                fill="#f4a28c"
              />
              <path
                d="M118.83,88.27s-8.17-9.32-11.32-4,7,9.15,7,9.15Z"
                fill="#f4a28c"
              />
              <rect
                x="98.81"
                y="158.79"
                width="197.12"
                height="14.28"
                fill="#e6e6e6"
              />
              <rect
                x="104.77"
                y="173.07"
                width="185.22"
                height="84.22"
                fill="#e6e6e6"
              />
              <polygon
                points="171.28 247.31 171.28 183.06 225.96 215.18 171.28 247.31"
                fill="#ffd200"
              />
              <path
                d="M290,173.07v24.08c-85.64-2.72-148.26,23.84-185.21,46.06V173.07Z"
                opacity="0.08"
              />
              <polygon
                points="109.78 158.77 106.37 139.49 130.56 139.49 132.66 155.93 143.75 156.08 143.75 158.77 109.78 158.77"
                fill="#24285b"
              />
              <rect
                x="335.62"
                y="79.74"
                width="5.19"
                height="162.11"
                fill="#e6e6e6"
              />
              <rect
                x="322.9"
                y="213.06"
                width="5.19"
                height="47.98"
                transform="translate(183.76 -139.85) rotate(33.33)"
                fill="#e6e6e6"
              />
              <rect
                x="348.34"
                y="213.06"
                width="5.19"
                height="47.98"
                transform="translate(774.4 242.33) rotate(146.67)"
                fill="#e6e6e6"
              />
              <rect
                x="333.65"
                y="75.18"
                width="9.12"
                height="9.12"
                fill="#b3b3b3"
              />
              <rect
                x="327.22"
                y="64.17"
                width="21.73"
                height="14.85"
                rx="3.03"
                fill="#e6e6e6"
              />
              <path
                d="M294,41.77c16-3.9,32.71,8.06,37.25,26.72s-4.79,36.93-20.83,40.83Z"
                fill="#b3b3b3"
              />
              <circle cx="67.33" cy="112.11" r="6.98" fill="#b3b3b3" />
              <rect
                x="59.7"
                y="124.03"
                width="3.47"
                height="28.78"
                transform="translate(122.88 276.84) rotate(-180)"
                fill="#e6e6e6"
              />
              <path
                d="M52.5,107.15h4.91l1.06-4.24h5.94l1.06,4.24h4.91a1.52,1.52,0,0,1,1.51,1.51v9.4a1.51,1.51,0,0,1-1.51,1.51H52.5A1.51,1.51,0,0,1,51,118.06v-9.4A1.52,1.52,0,0,1,52.5,107.15Z"
                fill="#e6e6e6"
              />
              <rect
                x="53.49"
                y="109.55"
                width="11.69"
                height="6.58"
                transform="translate(118.68 225.68) rotate(-180)"
                fill="#ffd200"
              />
              <rect
                x="57.62"
                y="119.57"
                width="7.63"
                height="5.14"
                transform="translate(122.88 244.28) rotate(-180)"
                fill="#b3b3b3"
              />
              <rect
                x="59.32"
                y="154.05"
                width="4.24"
                height="104.91"
                transform="translate(122.88 413.02) rotate(-180)"
                fill="#e6e6e6"
              />
              <rect
                x="74.08"
                y="153.35"
                width="4.24"
                height="104.91"
                transform="translate(193.46 391.31) rotate(168.02)"
                fill="#e6e6e6"
              />
              <rect
                x="44.56"
                y="153.35"
                width="4.24"
                height="104.91"
                transform="translate(43.75 -5.21) rotate(11.98)"
                fill="#e6e6e6"
              />
              <rect
                x="55.45"
                y="152.3"
                width="11.98"
                height="3.51"
                transform="translate(122.88 308.11) rotate(-180)"
                fill="#b3b3b3"
              />
              <path
                d="M277,148.7s-8-2.18-9.69-9.59c0,0,12.34-2.49,12.69,10.24Z"
                fill="#68e1fd"
                opacity="0.58"
              />
              <path
                d="M277.93,147.91s-5.56-8.79-.67-17c0,0,9.38,6,5.22,17Z"
                fill="#68e1fd"
                opacity="0.73"
              />
              <path
                d="M279.36,147.92s2.94-9.29,11.83-11c0,0,1.66,6-5.76,11.07Z"
                fill="#68e1fd"
              />
              <polygon
                points="273.59 147.71 275.2 158.75 285.37 158.79 286.87 147.76 273.59 147.71"
                fill="#24285b"
              />
            </svg>
          </div>
          <div className="flex flex-col w-full p-6 lg:w-2/3 md:p-8 lg:p-12">
            <h2 className="text-3xl font-semibold leading-none">
              Get access to key learning materials
            </h2>
            <p className="mt-4 mb-8">
              With accessible and free online content about Nx, you can quickly
              get up and running with all of Nx's features. Nx tutorials and
              resources are continuously updated with the latest version. Plus,
              when you're looking for advanced courses visit NxPlaybook.com.
            </p>
          </div>
        </div>
      </div>

      {/* NXCLOUD AD */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto my-12 py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            <span className="block">Ready to dive in?</span>
            <span className="block text-blue-600">Start using Nx today.</span>
          </h2>
          <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
            <div className="inline-flex rounded-md shadow">
              <a
                href="#"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Get started
              </a>
            </div>
            <div className="ml-3 inline-flex rounded-md shadow">
              <a
                href="#"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50"
              >
                Learn more
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Index;
