import { assign } from '@xstate/immer';
import { send } from 'xstate';
import { ProjectGraphStateNodeConfig } from './interfaces';

export const unselectedStateConfig: ProjectGraphStateNodeConfig = {
  entry: [send(() => ({ type: 'hideAll' }), { to: (ctx) => ctx.graphActor })],
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
