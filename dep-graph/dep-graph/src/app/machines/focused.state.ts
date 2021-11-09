import { assign } from '@xstate/immer';
import { selectProjectsForFocusedProject } from '../util';
import { DepGraphStateNodeConfig } from './interfaces';

export const focusedStateConfig: DepGraphStateNodeConfig = {
  entry: [
    assign((ctx, event: any) => {
      ctx.selectedProjects = selectProjectsForFocusedProject(
        ctx.projects,
        ctx.dependencies,
        event.projectName,
        ctx.searchDepthEnabled ? ctx.searchDepth : -1
      );

      ctx.focusedProject = event.projectName;
    }),
  ],
  exit: [
    assign((ctx) => {
      ctx.focusedProject = null;
    }),
  ],
  on: {
    incrementSearchDepth: {
      actions: [
        assign((ctx) => {
          const searchDepth = ctx.searchDepth + 1;
          const selectedProjects = selectProjectsForFocusedProject(
            ctx.projects,
            ctx.dependencies,
            ctx.focusedProject,
            ctx.searchDepthEnabled ? searchDepth : -1
          );

          ctx.selectedProjects = selectedProjects;
          ctx.searchDepth = searchDepth;
        }),
      ],
    },
    decrementSearchDepth: {
      actions: [
        assign((ctx) => {
          const searchDepth = ctx.searchDepth - 1;
          const selectedProjects = selectProjectsForFocusedProject(
            ctx.projects,
            ctx.dependencies,
            ctx.focusedProject,
            ctx.searchDepthEnabled ? searchDepth : -1
          );

          ctx.selectedProjects = selectedProjects;
          ctx.searchDepth = searchDepth;
        }),
      ],
    },
    setSearchDepthEnabled: {
      actions: [
        assign((ctx, event) => {
          const selectedProjects = selectProjectsForFocusedProject(
            ctx.projects,
            ctx.dependencies,
            ctx.focusedProject,
            event.searchDepthEnabled ? ctx.searchDepth : -1
          );

          (ctx.searchDepthEnabled = event.searchDepthEnabled),
            (ctx.selectedProjects = selectedProjects);
        }),
      ],
    },
    unfocusProject: {
      target: 'unselected',
    },
    updateGraph: {
      actions: [
        assign((ctx, event) => {
          const selectedProjects = selectProjectsForFocusedProject(
            event.projects,
            event.dependencies,
            ctx.focusedProject,
            ctx.searchDepthEnabled ? ctx.searchDepth : -1
          );

          ctx.projects = event.projects;
          ctx.dependencies = event.dependencies;
          ctx.selectedProjects = selectedProjects;
        }),
      ],
    },
  },
};
