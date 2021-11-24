import React, { ReactComponentElement } from 'react';

export function EventBanner(): ReactComponentElement<any> {
  return (
    <div className="relative bg-green-nx-base">
      <div className="max-w-7xl mx-auto py-4 px-3 sm:px-6 lg:px-8">
        <div className="pr-16 sm:text-center sm:px-16">
          <p className="font-medium text-white">
            New event! We're excited to announce a new Nx workshop on December.
            <span className="block sm:ml-2 sm:inline-block">
              <a
                href="https://ti.to/nrwl/nx-workshop-12-2021?utm_source=nx.dev"
                target="_blank"
                rel="nofollow"
                className="text-white font-bold underline group"
              >
                {' '}
                Register now{' '}
                <span
                  aria-hidden="true"
                  className="inline-block group-hover:translate-x-2 transition"
                >
                  &rarr;
                </span>
              </a>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default EventBanner;
