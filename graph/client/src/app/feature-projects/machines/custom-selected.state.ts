import { assign } from '@xstate/immer';
import { actions, send } from 'xstate';
import { ProjectGraphStateNodeConfig } from './interfaces';

export const customSelectedStateConfig: ProjectGraphStateNodeConfig = {
  on: {
    updateGraph: {
      target: 'customSelected',
      actions: [
        assign((ctx, event) => {
          const existingProjectNames = ctx.projects.map(
            (project) => project.name
          );
          const newProjectNames = event.projects.map((project) => project.name);
          const newSelectedProjects = newProjectNames.filter(
            (projectName) => !existingProjectNames.includes(projectName)
          );
          ctx.selectedProjects = [
            ...ctx.selectedProjects,
            ...newSelectedProjects,
          ];
        }),
        'setGraph',
      ],
    },
  },
};
