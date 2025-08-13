/* eslint-disable import/first */
// debug must be first import
if (process.env.NODE_ENV === 'development') {
  require('preact/debug');
}

import { projectDetailsMachine } from './app/console-project-details/project-details.machine';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraph, ProjectGraphProjectNode } from '@nx/devkit';
// nx-ignore-next-line
import type { GraphError } from 'nx/src/command-line/graph/graph';
// nx-ignore-next-line
import { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
// nx-ignore-next-line
import { GeneratedMigrationDetails } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */
import { ProjectGraphEvent } from '@nx/graph/projects';
import { inspect } from '@xstate/inspect';
import { render } from 'preact';
import { StrictMode } from 'react';
import { interpret } from 'xstate';
import { App } from './app/app';
import { ProjectGraphApp } from './app/console-graph/project-graph.app';
import { projectGraphMachine } from './app/console-graph/project-graph.machine';
import { MigrateApp } from './app/console-migrate/migrate.app';
import { migrateMachine } from './app/console-migrate/migrate.machine';
import { ProjectDetailsApp } from './app/console-project-details/project-details.app';
import { ExternalApiImpl } from './app/external-api-impl';
import { ErrorPage } from './app/ui-components/error-page';

console.log('hello', window.__NX_RENDER_GRAPH__);
if (true) {
  window.externalApi = new ExternalApiImpl();

  window.renderPDV = (data: {
    project: ProjectGraphProjectNode;
    sourceMap: Record<string, string[]>;
    connectedToCloud: boolean;
    errors?: GraphError[];
  }) => {
    const service = interpret(projectDetailsMachine).start();

    service.send({
      type: 'loadData',
      ...data,
    });

    render(
      <StrictMode>
        <ProjectDetailsApp service={service} />
      </StrictMode>,
      document.getElementById('app')
    );

    return service;
  };

  window.renderError = (data: {
    message: string;
    stack?: string;
    errors: GraphError[];
  }) => {
    render(
      <StrictMode>
        <ErrorPage {...data} />
      </StrictMode>,
      document.getElementById('app')
    );
  };

  window.renderMigrate = (data: {
    migrations: GeneratedMigrationDetails[];
    'nx-console': MigrationsJsonMetadata;
  }) => {
    const service = interpret(migrateMachine).start();

    service.send({
      type: 'loadData',
      ...data,
    });

    render(
      <StrictMode>
        <MigrateApp service={service} />
      </StrictMode>,
      document.getElementById('app')
    );

    return service;
  };

  window.renderProjectGraph = (
    projectGraph: ProjectGraph,
    initialCommand: ProjectGraphEvent
  ) => {
    const service = interpret(projectGraphMachine).start();
    service.send({
      type: 'loadData',
      projectGraph,
    });

    service.send({
      type: 'setInitialCommand',
      command: initialCommand,
    });
    render(
      <StrictMode>
        <ProjectGraphApp service={service} />
      </StrictMode>,
      document.getElementById('app')
    );

    return service;
  };

  // window.renderTaskGraph = (taskData: any) => {
  //   // Create event bridge for external communication
  //   const eventListeners = new Map<string, Set<Function>>();

  //   // Create a simple state machine service for external control
  //   const stateMachine = createMachine({
  //     id: 'taskGraph',
  //     initial: 'idle',
  //     states: {
  //       idle: {
  //         on: {
  //           RENDER: 'rendering',
  //           UPDATE: 'updating',
  //           SELECT_TASK: 'selecting',
  //           RUN_TASK: 'running',
  //         },
  //       },
  //       rendering: {
  //         on: {
  //           COMPLETE: 'idle',
  //         },
  //       },
  //       updating: {
  //         on: {
  //           COMPLETE: 'idle',
  //         },
  //       },
  //       selecting: {
  //         on: {
  //           COMPLETE: 'idle',
  //         },
  //       },
  //       running: {
  //         on: {
  //           COMPLETE: 'idle',
  //           FAILED: 'idle',
  //         },
  //       },
  //     },
  //   });

  //   const service = interpret(stateMachine).start();
  //   let graphClient: any = null;

  //   // Event bridge functions
  //   const emit = (eventType: string, data?: any) => {
  //     const listeners = eventListeners.get(eventType) || new Set();
  //     listeners.forEach((listener) => listener(data));
  //   };

  //   const on = (eventType: string, callback: Function) => {
  //     if (!eventListeners.has(eventType)) {
  //       eventListeners.set(eventType, new Set());
  //     }
  //     eventListeners.get(eventType)!.add(callback);

  //     // Return unsubscribe function
  //     return () => {
  //       eventListeners.get(eventType)?.delete(callback);
  //     };
  //   };

  //   render(
  //     <StrictMode>
  //       <StandaloneTaskGraph
  //         taskData={taskData}
  //         onGraphReady={(client) => {
  //           graphClient = client;

  //           // Set up event listeners for task-specific events
  //           if (graphClient.on) {
  //             graphClient.on('taskClick', (taskId: string) => {
  //               emit('taskClick', { taskId });
  //             });

  //             graphClient.on('taskRun', (taskId: string) => {
  //               emit('taskRun', { taskId });
  //             });

  //             graphClient.on(
  //               'taskComplete',
  //               (taskId: string, status: string) => {
  //                 emit('taskComplete', { taskId, status });
  //               }
  //             );

  //             graphClient.on('backgroundClick', () => {
  //               emit('backgroundClick');
  //             });
  //           }

  //           service.send('COMPLETE');
  //           emit('ready', { client: graphClient });
  //         }}
  //       />
  //     </StrictMode>,
  //     document.getElementById('app')
  //   );

  //   // Return enhanced API with event bridge
  //   return {
  //     service,
  //     send: (event: any) => {
  //       // Allow sending events from outside
  //       if (typeof event === 'string') {
  //         event = { type: event };
  //       }

  //       // Handle specific event types
  //       switch (event.type) {
  //         case 'SELECT_TASK':
  //           if (graphClient?.selectTask) {
  //             graphClient.selectTask(event.taskId);
  //           }
  //           break;
  //         case 'RUN_TASK':
  //           if (graphClient?.runTask) {
  //             graphClient.runTask(event.taskId);
  //           }
  //           break;
  //         case 'UPDATE_TASKS':
  //           if (graphClient?.updateTasks) {
  //             graphClient.updateTasks(event.tasks);
  //           }
  //           break;
  //         default:
  //           if (graphClient?.send) {
  //             graphClient.send(event);
  //           }
  //       }

  //       return service.send(event);
  //     },
  //     receive: (callback: (event: any) => void) => {
  //       // Set up event listeners for task events
  //       on('taskClick', callback);
  //       on('taskRun', callback);
  //       on('taskComplete', callback);
  //       on('backgroundClick', callback);
  //       on('ready', callback);
  //     },
  //     on, // Expose the on method for custom events
  //     emit, // Expose emit for triggering custom events
  //     getState: () => service.state.value,
  //     getGraphClient: () => graphClient,
  //   };
  // };
} else {
  if (window.useXstateInspect === true) {
    inspect({
      url: 'https://stately.ai/viz?inspect',
      iframe: false, // open in new window
    });
  }

  window.externalApi = new ExternalApiImpl();
  const container = document.getElementById('app');

  if (!window.appConfig) {
    render(
      <p>
        No environment could be found. Please run{' '}
        <pre>npx nx run graph-client:generate-dev-environment-js</pre>.
      </p>,
      container
    );
  } else {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
      container
    );
  }
}
