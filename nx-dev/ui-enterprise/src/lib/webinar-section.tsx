import React from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

export const WebinarSection: React.FC = () => {
  return (
    <p>
      <a
        href="https://bit.ly/48iV9DZ"
        title="See live event in details"
        className="group/event-link inline-flex space-x-6"
      >
        <span className="rounded-full bg-blue-600/10 px-3 py-1 text-sm/6 font-semibold text-blue-600 ring-1 ring-inset ring-blue-600/10 dark:bg-cyan-600/10 dark:text-cyan-600 dark:ring-cyan-600/10">
          Live event
        </span>
        <span className="inline-flex items-center space-x-2 text-sm/6 font-medium">
          <span>Webinar on October 27th</span>
          <ChevronRightIcon
            aria-hidden="true"
            className="size-5 transform transition-all group-hover/event-link:translate-x-1"
          />
        </span>
      </a>
    </p>
  );
};
