import React from 'react';
import { MemberCard } from '@nrwl/nx-dev/ui-member-card';

export function ConfWorkshop(): JSX.Element {
  return (
    <div className="border-t border-b border-gray-600">
      <div className="mx-auto max-w-screen-lg text-white xl:max-w-screen-xl">
        <article className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-gray-600">
          <div className="px-5 py-12 md:pr-12">
            <div className="font-input-mono text-green-nx-base">
              September 14 & 15
            </div>
            <h2 className="font-input-mono pt-8 pb-2 text-2xl">
              Develop at Scale with Nx Monorepos
            </h2>
            <p className="text-md mb-8 text-gray-400">
              Presented by Nrwl on September 14th and 15th, 10:30am - 5:30pm ET
            </p>
            <p className="text-gray-400">
              We'll kick off the Nx Conf festivities with a 2-day deep dive into
              all things Nx! The Nx Workshop is the official workshop created
              and maintained by the Nx Core Team at Nrwl. In these two days,
              Nrwl architects will cover the breadth of tools and techniques
              needed for any tech lead or individual contributor to be
              successful working in an Nx workspace.
            </p>
            <h4 className="font-input-mono mt-8 mb-4 text-lg">
              $800 All-Inclusive
            </h4>
            <p className="mb-4 text-gray-400">
              Each ticket for the Nx Workshop is $800, and includes both days of
              the workshop, as well as a free coupon for the Advanced Nx
              Workspaces course on nxplaybook.com, and a gift box to be shipped
              to you that includes the coveted "10x Nx Developer" t-shirt.
            </p>
            <p className="mb-4 text-gray-400">
              The workshop consists of short presentations, followed by hands-on
              codelabs.
            </p>

            <h4 className="font-input-mono mb-2 text-lg">Day 1</h4>
            <ul className="mb-4 text-sm text-gray-400">
              <li>
                <span role="img" aria-label="emojii">
                  🔬
                </span>
                &nbsp; Lab 1 - Generate an empty workspace
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  ⚗️
                </span>
                &nbsp; Lab 2 - Generate an Angular app
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  🧪
                </span>
                &nbsp; Lab 3 - Executors
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  🔭
                </span>
                &nbsp; Lab 4 - Generate a component lib
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  🧬
                </span>
                &nbsp; Lab 5 - Generate a utility lib
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  🧮
                </span>
                &nbsp; Lab 6 - Generate a route lib
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  🤖
                </span>
                &nbsp; Lab 7 - Add a NestJS API
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  📐
                </span>
                &nbsp; Lab 8 - Displaying a full game in the routed game-detail
                component
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  💻
                </span>
                &nbsp; Lab 9 - Generate a type lib that the API and frontend can
                share
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  👩‍💻
                </span>
                &nbsp; Lab 10 - Generate Storybook stories for the shared ui
                component
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  ⌨️
                </span>
                &nbsp; Lab 11 - E2E test the shared component
              </li>
            </ul>

            <h4 className="font-input-mono mb-2 text-lg">Day 2</h4>
            <ul className="text-sm text-gray-400">
              <li>
                <span role="img" aria-label="emojii">
                  💡
                </span>
                &nbsp; Lab 12 - Module boundaries
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  🧸️
                </span>
                &nbsp; Lab 13 - Workspace Generators - Intro
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  🧵
                </span>
                &nbsp; Lab 14 - Workspace Generators - Modifying files
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  💎
                </span>
                &nbsp; Lab 15 - Setting up CI
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  🔌
                </span>
                &nbsp; Lab 16 - Distributed caching
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  🔍
                </span>
                &nbsp; Lab 17 - NxCloud GitHub bot
              </li>
              <li>
                <span role="img" aria-label="emojii">
                  📎
                </span>
                &nbsp; Lab 18 - Run-Commands and deploying the frontend
              </li>
              <li>
                <b>
                  Q&A with Jeff Cross, Victor Savkin, Jason Jean, and Jack Hsu
                </b>
              </li>
            </ul>
          </div>
          <div className="divide-y divide-gray-600 py-12">
            <div className="px-5 pb-12 md:w-4/5 md:pl-12">
              <h3 className="font-input-mono mb-8 text-xl">Instructors</h3>
              <MemberCard
                imageUrl="/images/conf/kirils-ladovs.webp"
                name="Kirils Ladovs"
                description="Sr. Engineer / Nrwl"
              />
              <MemberCard
                imageUrl="/images/conf/rares-matei.webp"
                name="Rares Matei"
                description="Sr. JavaScript Engineer / Nrwl"
              />
              {/* <MemberCard
                imageUrl="/images/conf/craigory-coppola.webp"
                name="Craigory Coppola"
                description="Sr. JavaScript Engineer / Nrwl"
              /> */}
            </div>
            <div className="workshop-border-r px-5 py-12 md:pl-12">
              <h3 className="font-input-mono mb-8 text-xl">
                What you'll learn
              </h3>
              <p className="text-gray-400">
                We’ll build up a monorepo from scratch, creating a client app
                and server app that share an API type library. We’ll learn how
                Nx uses builder commands and schemeatics to make the developer
                experience more consistent across projects. We’ll then make our
                own builders and schematics for processes that are unique to our
                organization. We’ll also explore the growing ecosystem of
                plugins that allow for the smooth integration of frameworks and
                libraries.
              </p>
              <div className="m-auto my-12 grid w-2/3 grid-cols-3 justify-items-center gap-4">
                <svg viewBox="0 0 24 24" className="w-18 h-18" fill="#52C1DE">
                  <path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z" />
                </svg>
                <div className="font-input-mono text-6xl">||</div>
                <svg viewBox="0 0 24 24" className="w-18 h-18" fill="#E23236">
                  <path d="M9.931 12.645h4.138l-2.07-4.908m0-7.737L.68 3.982l1.726 14.771L12 24l9.596-5.242L23.32 3.984 11.999.001zm7.064 18.31h-2.638l-1.422-3.503H8.996l-1.422 3.504h-2.64L12 2.65z" />
                </svg>
              </div>
              <p className="text-gray-400">
                All codelabs are available in either React or Angular, but the
                concepts are the same.
              </p>
            </div>
            <div className="px-5 pt-12 md:pl-12">
              <a
                className="font-input-mono group flex w-full items-center sm:text-xl"
                href="https://nrwl.io/contact-us?utm_source=nxdev"
              >
                <span className="group-hover:underline">
                  Contact us for the workshop
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="ml-1 h-8 w-8 transform-gpu transition duration-200 ease-out group-hover:translate-x-2 "
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
