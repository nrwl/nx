import React from 'react';

/* eslint-disable-next-line */
export interface SidebarProps {}

export function Sidebar(props: SidebarProps) {
  return (
    <div
      id="sidebar"
      className="fixed z-40 inset-0 flex-none h-full bg-black bg-opacity-25 w-full lg:bg-white lg:static lg:h-auto lg:overflow-y-visible lg:pt-o lg:w-60 xl:w-72 lg:block hidden"
    >
      <div
        id="navigation-wrapper"
        className="h-full overflow-y-auto scrolling-touch lg:h-auto lg:block lg:relative lg:sticky lg:bg-transparent overflow-hidden lg:top-18 bg-white mr-24 lg:mr-0"
      >
        <div className="hidden lg:block h-12 pointer-events-none absolute inset-x-0 z-10 bg-gradient-to-b from-white"></div>
        <nav
          id="navigation"
          className="px-1 pt-6 overflow-y-auto font-medium text-base sm:px-3 xl:px-5 lg:text-sm pb-10 lg:pt-10 lg:pb-14 sticky?lg:h-(screen-18)"
        >
          <ul>
            <li className="mt-8">
              <h5 className="px-3 mb-3 lg:mb-3 uppercase tracking-wide font-semibold text-sm lg:text-xs text-gray-900">
                Getting Started
              </h5>
              <ul>
                <li>
                  <a
                    href="#"
                    className="px-3 py-2 transition-colors duration-180 relative block text-blue-700"
                  >
                    <span className="rounded-md absolute inset-0 bg-blue-50"></span>
                    <span className="relative">Why Nx?</span>
                  </a>
                </li>
                <li>
                  <a
                    className="px-3 py-2 transition-colors duration-200 relative block hover:text-gray-900 text-gray-500"
                    href="#"
                  >
                    <span className="rounded-md absolute inset-0 bg-blue-50 opacity-0"></span>
                    <span className="relative">Release Notes</span>
                  </a>
                </li>
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default Sidebar;
