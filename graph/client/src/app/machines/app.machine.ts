import { assign } from '@xstate/immer';
import { ActorRef, createMachine, send, spawn } from 'xstate';
// nx-ignore-next-line
import {
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';
import { projectGraphMachine } from '../feature-projects/machines/project-graph.machine';
import {
  taskGraphMachine,
  TaskGraphRecord,
} from '../feature-tasks/machines/task-graph.machine';
import { GraphPerfReport } from '../interfaces';

export interface AppContext {
  projects: ProjectGraphProjectNode[];
  dependencies: Record<string, ProjectGraphDependency[]>;
  affectedProjects: string[];
  workspaceLayout: {
    libsDir: string;
    appsDir: string;
  };
  taskGraphs: TaskGraphRecord;
  projectGraphActor: ActorRef<any>;
  taskGraphActor: ActorRef<any>;
  lastPerfReport: GraphPerfReport;
}

export const initialContext: AppContext = {
  projects: [],
  dependencies: {},
  affectedProjects: [],
  workspaceLayout: {
    libsDir: '',
    appsDir: '',
  },
  taskGraphs: {},
  projectGraphActor: null,
  taskGraphActor: null,
  lastPerfReport: {
    numEdges: 0,
    numNodes: 0,
    renderTime: 0,
  },
};

export interface AppSchema {
  states: {
    idle: {};
    initialized: {};
  };
}

export type AppEvents =
  | {
      type: 'setProjects';
      projects: ProjectGraphProjectNode[];
      dependencies: Record<string, ProjectGraphDependency[]>;
      affectedProjects: string[];
      workspaceLayout: {
        libsDir: string;
        appsDir: string;
      };
    }
  | {
      type: 'setTaskGraphs';
      taskGraphs: TaskGraphRecord;
    };

export const appMachine = createMachine<AppContext, AppEvents>(
  {
    predictableActionArguments: true,
    id: 'App',
    initial: 'idle',
    context: initialContext,
    states: {
      idle: {
        entry: assign((ctx) => {
          ctx.projectGraphActor = spawn(projectGraphMachine, {
            name: 'projectGraphActor',
          });

          ctx.taskGraphActor = spawn(taskGraphMachine, {
            name: 'taskGraphActor',
          });
        }),
      },
      initialized: {},
    },
    on: {
      setProjects: {
        target: 'initialized',
        actions: [
          'setProjects',
          send(
            (ctx, event) => ({
              type: 'notifyProjectGraphSetProjects',
              projects: ctx.projects,
              dependencies: ctx.dependencies,
              affectedProjects: ctx.affectedProjects,
              workspaceLayout: ctx.workspaceLayout,
            }),
            {
              to: (context) => context.projectGraphActor,
            }
          ),
        ],
      },
      setTaskGraphs: {
        target: 'initialized',
        actions: [
          'setTaskGraphs',
          send(
            (ctx, event) => ({
              type: 'notifyTaskGraphSetProjects',
              projects: ctx.projects,
              taskGraphs: ctx.taskGraphs,
            }),
            {
              to: (context) => context.taskGraphActor,
            }
          ),
        ],
      },
    },
  },
  {
    actions: {
      setProjects: assign((ctx, event) => {
        if (event.type !== 'setProjects') return;

        ctx.projects = event.projects;
        ctx.dependencies = event.dependencies;
        ctx.workspaceLayout = event.workspaceLayout;
        ctx.affectedProjects = event.affectedProjects;
      }),
      setTaskGraphs: assign((ctx, event) => {
        if (event.type !== 'setTaskGraphs') return;

        ctx.taskGraphs = event.taskGraphs;
      }),
    },
  }
);
