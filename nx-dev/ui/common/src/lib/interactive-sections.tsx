import React, { useState } from 'react';
import { useMediaQuery } from './media-query';
import gfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';

/* eslint-disable-next-line */
export interface InteractiveSectionsProps {
  itemList: {
    title: string;
    content: string;
  }[];
}

export function InteractiveSections({ itemList }: InteractiveSectionsProps) {
  const [selectedItem, setSelectedItem] = useState(0);
  const isLargeLayout = useMediaQuery('(min-width: 1024px)');
  return (
    <section className="my-32 flex sm:flex-row flex-col items-center justify-center">
      <div className="w-full hidden lg:w-2/6 lg:flex flex-col justify-between items-start lg:pb-0 pb-10 mt-8 lg:mt-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="hidden"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            id="selectionArrow"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7l5 5m0 0l-5 5m5-5H6"
          />
        </svg>
        {itemList.map((item, index) => (
          <h2
            key={item.title}
            onClick={() => setSelectedItem(index)}
            className="group text-2xl leading-none font-extrabold text-gray-900 tracking-tight py-4 my-2 flex cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={
                selectedItem === index
                  ? 'h-6 w-6 mr-2'
                  : 'h-6 w-6 mr-2 invisible group-hover:visible'
              }
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <use xlinkHref="#selectionArrow" />
            </svg>
            {item.title}
          </h2>
        ))}
      </div>
      <div className="w-full lg:w-4/6 flex flex-col justify-between items-start lg:pl-16 lg:pb-0 pb-10 mt-8 lg:mt-0">
        {itemList.map((item, index) => (
          <div
            key={item.title}
            hidden={selectedItem !== index && isLargeLayout}
            className="py-6"
          >
            <h2 className="text-xl lg:hidden leading-none font-extrabold text-gray-900 tracking-tight mb-4">
              {item.title}
            </h2>
            <ReactMarkdown
              remarkPlugins={[gfm]}
              children={item.content}
              className="prose text-gray-500 sm:text-lg"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default InteractiveSections;
