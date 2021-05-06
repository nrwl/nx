import React from 'react';

/* eslint-disable-next-line */
export interface TocProps {}

export function Toc(props: TocProps) {
  return (
    <div className="mb-8">
      <h5 className="text-gray-900 uppercase tracking-wide font-semibold mb-3 text-sm lg:text-xs">
        On this page
      </h5>
      <ul className="overlflow-x-hidden text-gray-500 font-medium">
        <li>
          <a
            href="#"
            className="block transform transition-colors duration-180 py-2 hover:text-gray-900 text-gray-900"
          >
            Some item
          </a>
        </li>
        <li>
          <a
            href="#"
            className="block transform transition-colors duration-180 py-2 hover:text-gray-900"
          >
            Some item
          </a>
        </li>
      </ul>
    </div>
  );
}

export default Toc;
