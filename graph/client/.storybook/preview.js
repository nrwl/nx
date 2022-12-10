import '../src/styles.scss';

import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { themes } from '@storybook/theming';

export const parameters = {
  darkMode: {
    // Override the default dark theme
    dark: { ...themes.dark, appContentBg: 'rgb(15, 23, 42, 1)' },
    // Override the default light theme
    light: themes.normal,
    stylePreview: true,
  },
};
export const decorators = [
  (Story, context) => {
    return (
      <MemoryRouter initialEntries={['/']}>
        <div className="bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          {context.title.startsWith('Project Graph') ? (
            <div className="flex justify-center">
              <div className="relative flex h-full w-72 flex-col overflow-y-scroll pb-10 shadow-lg ring-1 ring-slate-900/10 ring-opacity-10 transition-all dark:ring-slate-300/10">
                <Story />
              </div>
            </div>
          ) : (
            <Story />
          )}
        </div>
      </MemoryRouter>
    );
  },
];
