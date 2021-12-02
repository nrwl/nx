import { memo } from 'react';

export interface ShowHideAllProjectsProps {
  showAllProjects: () => void;
  hideAllProjects: () => void;
  showAffectedProjects: () => void;
  hasAffectedProjects: boolean;
}

export const ShowHideAllProjects = memo(
  ({
    showAllProjects,
    hideAllProjects,
    showAffectedProjects,
    hasAffectedProjects: affectedProjects,
  }: ShowHideAllProjectsProps) => {
    return (
      <div className="mt-8 px-4">
        <button
          onClick={showAllProjects}
          type="button"
          className="w-full flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          data-cy="selectAllButton"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="-ml-1 mr-2 h-5 w-5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          Show all projects
        </button>

        {affectedProjects ? (
          <button
            onClick={showAffectedProjects}
            type="button"
            className="mt-3 w-full flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-500 bg-white hover:bg-red-50"
            data-cy="affectedButton"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="-ml-1 mr-2 h-5 w-5 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Show affected projects
          </button>
        ) : null}

        <button
          onClick={hideAllProjects}
          type="button"
          className="mt-3 w-full flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          data-cy="deselectAllButton"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="-ml-1 mr-2 h-5 w-5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            />
          </svg>
          Hide all projects
        </button>
      </div>
    );
  }
);

export default ShowHideAllProjects;
