import { ReactComponentElement } from 'react';

export interface PluginCardProps {
  name: string;
  description: string;
  url: string;
  isOfficial: boolean;
}

export function PluginCard({
  name,
  description,
  url,
  isOfficial,
}: PluginCardProps): ReactComponentElement<any> {
  return (
    <div className="focus-within:ring-blue-nx-base relative flex w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm transition focus-within:ring-2 focus-within:ring-offset-2 hover:bg-gray-50">
      <div className="flex w-full flex-col px-4 py-3">
        <h3 className="mb-4 flex text-lg font-semibold leading-tight">
          <svg
            className="mr-3 h-5 w-5 text-gray-800"
            role="img"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>GitHub</title>
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>{' '}
          {name}
        </h3>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title={name}
          className="focus:outline-none"
        >
          <span className="absolute inset-0" aria-hidden="true"></span>
          <p className="mb-6 sm:text-sm">{description}</p>

          {isOfficial ? (
            <span
              title="Official plugins are maintained by the Nx Team"
              className="bg-green-nx-base absolute bottom-3 right-4 rounded-full px-3 py-0.5 text-xs font-medium capitalize text-white"
            >
              Official
            </span>
          ) : null}
        </a>
      </div>
    </div>
  );
}

export default PluginCard;
