import { assign } from '@xstate/immer';
import { filterProjectsByText } from '../util';
import { DepGraphStateNodeConfig } from './interfaces';

export const textFilteredStateConfig: DepGraphStateNodeConfig = {
  entry: [
    assign((ctx, event: any) => {
      ctx.textFilter = event.search;
      ctx.selectedProjects = filterProjectsByText(
        event.search,
        ctx.includePath,
        ctx.searchDepthEnabled ? ctx.searchDepth : -1,
        ctx.projects,
        ctx.dependencies
      );
    }),
  ],
  on: {
    clearTextFilter: {
      target: 'unselected',
      actions: assign((ctx) => {
        ctx.includePath = false;
        ctx.textFilter = '';
      }),
    },
    setIncludeProjectsByPath: {
      actions: [
        assign((ctx, event) => {
          ctx.includePath = event.includeProjectsByPath;
          ctx.selectedProjects = filterProjectsByText(
            ctx.textFilter,
            event.includeProjectsByPath,
            ctx.searchDepthEnabled ? ctx.searchDepth : -1,
            ctx.projects,
            ctx.dependencies
          );
        }),
      ],
    },
    incrementSearchDepth: {
      actions: [
        assign((ctx) => {
          const searchDepth = ctx.searchDepth + 1;
          ctx.selectedProjects = filterProjectsByText(
            ctx.textFilter,
            ctx.includePath,
            ctx.searchDepthEnabled ? searchDepth : -1,
            ctx.projects,
            ctx.dependencies
          );

          ctx.searchDepth = searchDepth;
        }),
      ],
    },
    decrementSearchDepth: {
      actions: [
        assign((ctx) => {
          const searchDepth = ctx.searchDepth > 1 ? ctx.searchDepth - 1 : 1;
          ctx.selectedProjects = filterProjectsByText(
            ctx.textFilter,
            ctx.includePath,
            ctx.searchDepthEnabled ? searchDepth : -1,
            ctx.projects,
            ctx.dependencies
          );

          ctx.searchDepth = searchDepth;
        }),
      ],
    },
    setSearchDepthEnabled: {
      actions: [
        assign((ctx, event) => {
          ctx.searchDepthEnabled = event.searchDepthEnabled;
          ctx.selectedProjects = filterProjectsByText(
            ctx.textFilter,
            ctx.includePath,
            event.searchDepthEnabled ? ctx.searchDepth : -1,
            ctx.projects,
            ctx.dependencies
          );
        }),
      ],
    },
    updateGraph: {
      actions: [
        assign((ctx, event) => {
          ctx.selectedProjects = filterProjectsByText(
            ctx.textFilter,
            ctx.includePath,
            ctx.searchDepthEnabled ? ctx.searchDepth : -1,
            event.projects,
            event.dependencies
          );

          ctx.projects = event.projects;
          ctx.dependencies = event.dependencies;
        }),
      ],
    },
  },
};
