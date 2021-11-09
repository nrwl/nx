import { assign } from '@xstate/immer';
import { DepGraphStateNodeConfig } from './interfaces';

export const unselectedStateConfig: DepGraphStateNodeConfig = {
  entry: [
    assign((ctx) => {
      ctx.selectedProjects = [];
    }),
  ],
  on: {
    updateGraph: {
      actions: [
        assign((ctx, event) => {
          const existingProjectNames = ctx.projects.map(
            (project) => project.name
          );
          const newProjectNames = event.projects.map((project) => project.name);
          const selectedProjects = newProjectNames.filter(
            (projectName) => !existingProjectNames.includes(projectName)
          );

          ctx.projects = event.projects;
          ctx.dependencies = event.dependencies;
          ctx.selectedProjects = [...ctx.selectedProjects, ...selectedProjects];
        }),
      ],
    },
  },
};
