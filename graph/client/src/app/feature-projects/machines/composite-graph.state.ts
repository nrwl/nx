import { ProjectGraphStateNodeConfig } from './interfaces';
import { assign } from '@xstate/immer';
import { send } from 'xstate';

export const compositeGraphStateConfig: ProjectGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      if (event.type !== 'enableCompositeGraph') return;
      ctx.compositeGraph.enabled = true;
      ctx.compositeGraph.context = event.context || undefined;
    }),
    send(
      (ctx) => ({
        type: 'notifyGraphUpdateGraph',
        projects: ctx.projects,
        dependencies: ctx.dependencies,
        fileMap: ctx.fileMap,
        affectedProjects: ctx.affectedProjects,
        workspaceLayout: ctx.workspaceLayout,
        groupByFolder: ctx.groupByFolder,
        selectedProjects: ctx.selectedProjects,
        composite: ctx.compositeGraph,
      }),
      { to: (ctx) => ctx.graphActor }
    ),
  ],
  exit: [
    assign((ctx) => {
      ctx.compositeGraph.enabled = false;
      ctx.compositeGraph.context = undefined;
    }),
    send(
      (ctx) => ({
        type: 'notifyGraphUpdateGraph',
        projects: ctx.projects,
        dependencies: ctx.dependencies,
        fileMap: ctx.fileMap,
        affectedProjects: ctx.affectedProjects,
        workspaceLayout: ctx.workspaceLayout,
        groupByFolder: ctx.groupByFolder,
        selectedProjects: ctx.selectedProjects,
        composite: ctx.compositeGraph,
      }),
      {
        to: (ctx) => ctx.graphActor,
      }
    ),
  ],
  on: {
    selectAll: {
      actions: [
        assign((ctx, event) => {
          if (event.type !== 'selectAll') return;
          ctx.compositeGraph.enabled = true;
          ctx.compositeGraph.context = null;
        }),
        send((ctx) => ({
          type: 'enableCompositeGraph',
          context: ctx.compositeGraph.context,
        })),
      ],
    },
    deselectAll: {
      actions: [
        assign((ctx, event) => {
          if (event.type !== 'deselectAll') return;
          ctx.compositeGraph.enabled = true;
        }),
        send(
          () => ({
            type: 'notifyGraphHideAllProjects',
          }),
          { to: (context) => context.graphActor }
        ),
      ],
    },
    selectAffected: {
      actions: [
        send(
          () => ({
            type: 'notifyGraphShowAffectedProjects',
          }),
          { to: (context) => context.graphActor }
        ),
      ],
    },
    focusProject: {
      actions: [
        assign((ctx, event) => {
          if (event.type !== 'focusProject') return;
          ctx.focusedProject = event.projectName;
        }),
        send(
          (context, event) => ({
            type: 'notifyGraphFocusProject',
            projectName: context.focusedProject,
            searchDepth: context.searchDepthEnabled ? context.searchDepth : -1,
          }),
          { to: (context) => context.graphActor }
        ),
      ],
    },
    unfocusProject: {
      actions: [
        assign((ctx, event) => {
          if (event.type !== 'unfocusProject') return;
          ctx.focusedProject = null;
        }),
        send((ctx) => ({
          type: 'enableCompositeGraph',
          context: ctx.compositeGraph.context,
        })),
      ],
    },
    deselectProject: {
      actions: [
        send(
          (ctx, event) => ({
            type: 'notifyGraphHideProjects',
            projectNames: [event.projectName],
          }),
          { to: (ctx) => ctx.graphActor }
        ),
      ],
    },
    selectProject: {
      actions: [
        send(
          (ctx, event) => ({
            type: 'notifyGraphShowProjects',
            projectNames: [event.projectName],
          }),
          { to: (ctx) => ctx.graphActor }
        ),
      ],
    },
    expandCompositeNode: {
      actions: [
        send(
          (ctx, event) => ({
            type: 'notifyGraphExpandCompositeNode',
            id: event.id,
          }),
          { to: (ctx) => ctx.graphActor }
        ),
      ],
    },
    collapseCompositeNode: {
      actions: [
        send(
          (ctx, event) => ({
            type: 'notifyGraphCollapseCompositeNode',
            id: event.id,
          }),
          { to: (ctx) => ctx.graphActor }
        ),
      ],
    },
    enableCompositeGraph: {
      actions: [
        assign((ctx, event) => {
          if (event.type !== 'enableCompositeGraph') return;
          ctx.compositeGraph.enabled = true;
          ctx.compositeGraph.context = event.context || undefined;
          ctx.focusedProject = null;
        }),
        send(
          (ctx, event) => ({
            type: 'notifyGraphUpdateGraph',
            projects: ctx.projects,
            dependencies: ctx.dependencies,
            fileMap: ctx.fileMap,
            affectedProjects: ctx.affectedProjects,
            workspaceLayout: ctx.workspaceLayout,
            groupByFolder: ctx.groupByFolder,
            selectedProjects: ctx.selectedProjects,
            composite: ctx.compositeGraph,
          }),
          { to: (ctx) => ctx.graphActor }
        ),
      ],
    },
    disableCompositeGraph: {
      target: 'unselected',
    },
    updateGraph: {
      actions: [
        'setGraph',
        send(
          (ctx, event) => ({
            type: 'notifyGraphUpdateGraph',
            projects: ctx.projects,
            dependencies: ctx.dependencies,
            fileMap: ctx.fileMap,
            affectedProjects: ctx.affectedProjects,
            workspaceLayout: ctx.workspaceLayout,
            groupByFolder: ctx.groupByFolder,
            selectedProjects: ctx.selectedProjects,
            composite: ctx.compositeGraph,
          }),
          { to: (ctx) => ctx.graphActor }
        ),
      ],
    },
  },
};
