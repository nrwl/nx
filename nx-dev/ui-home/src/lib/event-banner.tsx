import React, { ReactComponentElement } from 'react';

export function EventBanner(): ReactComponentElement<any> {
  return (
    <div className="bg-green-nx-base relative">
      <div className="mx-auto max-w-7xl py-4 px-3 sm:px-6 lg:px-8">
        <div className="pr-16 sm:px-16 sm:text-center">
          <p className="font-medium text-white">
            New event! We're excited to announce a new Nx workshop on December.
            <span className="block sm:ml-2 sm:inline-block">
              <a
                href="https://ti.to/nrwl/nx-workshop-12-2021?utm_source=nx.dev"
                target="_blank"
                rel="noreferrer"
                className="group font-bold text-white underline"
              >
                {' '}
                Register now{' '}
                <span
                  aria-hidden="true"
                  className="inline-block transition group-hover:translate-x-2"
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
