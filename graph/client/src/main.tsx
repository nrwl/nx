/* eslint-disable import/first */
// debug must be first import
if (process.env.NODE_ENV === 'development') {
  require('preact/debug');
}

import { projectDetailsMachine } from './app/console-project-details/project-details.machine';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
// nx-ignore-next-line
import type { GraphError } from 'nx/src/command-line/graph/graph';
// nx-ignore-next-line
import { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
// nx-ignore-next-line
import { GeneratedMigrationDetails } from 'nx/src/config/misc-interfaces';
/* eslint-enable @nx/enforce-module-boundaries */
import { StrictMode } from 'react';
import { inspect } from '@xstate/inspect';
import { App } from './app/app';
import { ExternalApiImpl } from './app/external-api-impl';
import { render } from 'preact';
import { ErrorPage } from './app/ui-components/error-page';
import { ProjectDetailsApp } from './app/console-project-details/project-details.app';
import { createMachine, interpret } from 'xstate';
import { MigrateApp } from './app/console-migrate/migrate.app';
import { migrateMachine } from './app/console-migrate/migrate.machine';
import { StandaloneProjectGraph } from './app/standalone-project-graph';
import { StandaloneTaskGraph } from './app/standalone-task-graph';

if (window.__NX_RENDER_GRAPH__ === false) {
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

  window.renderProjectGraph = (projectData: any) => {
    // Create event bridge for external communication
    const eventListeners = new Map<string, Set<Function>>();

    // Create a simple state machine service for external control
    const stateMachine = createMachine({
      id: 'projectGraph',
      initial: 'idle',
      states: {
        idle: {
          on: {
            RENDER: 'rendering',
            UPDATE: 'updating',
            FOCUS_NODE: 'focusing',
            HIGHLIGHT_EDGE: 'highlighting',
          },
        },
        rendering: {
          on: {
            COMPLETE: 'idle',
          },
        },
        updating: {
          on: {
            COMPLETE: 'idle',
          },
        },
        focusing: {
          on: {
            COMPLETE: 'idle',
          },
        },
        highlighting: {
          on: {
            COMPLETE: 'idle',
          },
        },
      },
    });

    const service = interpret(stateMachine).start();
    let graphClient: any = null;

    // Event bridge functions
    const emit = (eventType: string, data?: any) => {
      const listeners = eventListeners.get(eventType) || new Set();
      listeners.forEach((listener) => listener(data));
    };

    const on = (eventType: string, callback: Function) => {
      if (!eventListeners.has(eventType)) {
        eventListeners.set(eventType, new Set());
      }
      eventListeners.get(eventType)!.add(callback);

      // Return unsubscribe function
      return () => {
        eventListeners.get(eventType)?.delete(callback);
      };
    };

    render(
      <StrictMode>
        <StandaloneProjectGraph
          projectData={projectData}
          onGraphReady={(client) => {
            graphClient = client;

            // Set up event listeners for graph state changes
            if (graphClient.on) {
              graphClient.on('nodeClick', (nodeId: string) => {
                emit('nodeClick', { nodeId });
              });

              graphClient.on('edgeClick', (edgeId: string) => {
                emit('edgeClick', { edgeId });
              });

              graphClient.on('backgroundClick', () => {
                emit('backgroundClick');
              });
            }

            service.send('COMPLETE');
            emit('ready', { client: graphClient });
          }}
        />
      </StrictMode>,
      document.getElementById('app')
    );

    // Return enhanced API with event bridge
    return {
      service,
      send: (event: any) => {
        // Allow sending events from outside
        if (typeof event === 'string') {
          event = { type: event };
        }

        // Handle specific event types
        switch (event.type) {
          case 'FOCUS_NODE':
            if (graphClient?.focusNode) {
              graphClient.focusNode(event.nodeId);
            }
            break;
          case 'HIGHLIGHT_EDGE':
            if (graphClient?.highlightEdge) {
              graphClient.highlightEdge(event.edgeId);
            }
            break;
          case 'UPDATE_DATA':
            if (graphClient?.updateData) {
              graphClient.updateData(event.data);
            }
            break;
          default:
            if (graphClient?.send) {
              graphClient.send(event);
            }
        }

        return service.send(event);
      },
      receive: (callback: (event: any) => void) => {
        // Set up event listeners for graph state changes
        on('nodeClick', callback);
        on('edgeClick', callback);
        on('backgroundClick', callback);
        on('ready', callback);
      },
      on, // Expose the on method for custom events
      emit, // Expose emit for triggering custom events
      getState: () => service.state.value,
      getGraphClient: () => graphClient,
    };
  };

  window.renderTaskGraph = (taskData: any) => {
    // Create event bridge for external communication
    const eventListeners = new Map<string, Set<Function>>();

    // Create a simple state machine service for external control
    const stateMachine = createMachine({
      id: 'taskGraph',
      initial: 'idle',
      states: {
        idle: {
          on: {
            RENDER: 'rendering',
            UPDATE: 'updating',
            SELECT_TASK: 'selecting',
            RUN_TASK: 'running',
          },
        },
        rendering: {
          on: {
            COMPLETE: 'idle',
          },
        },
        updating: {
          on: {
            COMPLETE: 'idle',
          },
        },
        selecting: {
          on: {
            COMPLETE: 'idle',
          },
        },
        running: {
          on: {
            COMPLETE: 'idle',
            FAILED: 'idle',
          },
        },
      },
    });

    const service = interpret(stateMachine).start();
    let graphClient: any = null;

    // Event bridge functions
    const emit = (eventType: string, data?: any) => {
      const listeners = eventListeners.get(eventType) || new Set();
      listeners.forEach((listener) => listener(data));
    };

    const on = (eventType: string, callback: Function) => {
      if (!eventListeners.has(eventType)) {
        eventListeners.set(eventType, new Set());
      }
      eventListeners.get(eventType)!.add(callback);

      // Return unsubscribe function
      return () => {
        eventListeners.get(eventType)?.delete(callback);
      };
    };

    render(
      <StrictMode>
        <StandaloneTaskGraph
          taskData={taskData}
          onGraphReady={(client) => {
            graphClient = client;

            // Set up event listeners for task-specific events
            if (graphClient.on) {
              graphClient.on('taskClick', (taskId: string) => {
                emit('taskClick', { taskId });
              });

              graphClient.on('taskRun', (taskId: string) => {
                emit('taskRun', { taskId });
              });

              graphClient.on(
                'taskComplete',
                (taskId: string, status: string) => {
                  emit('taskComplete', { taskId, status });
                }
              );

              graphClient.on('backgroundClick', () => {
                emit('backgroundClick');
              });
            }

            service.send('COMPLETE');
            emit('ready', { client: graphClient });
          }}
        />
      </StrictMode>,
      document.getElementById('app')
    );

    // Return enhanced API with event bridge
    return {
      service,
      send: (event: any) => {
        // Allow sending events from outside
        if (typeof event === 'string') {
          event = { type: event };
        }

        // Handle specific event types
        switch (event.type) {
          case 'SELECT_TASK':
            if (graphClient?.selectTask) {
              graphClient.selectTask(event.taskId);
            }
            break;
          case 'RUN_TASK':
            if (graphClient?.runTask) {
              graphClient.runTask(event.taskId);
            }
            break;
          case 'UPDATE_TASKS':
            if (graphClient?.updateTasks) {
              graphClient.updateTasks(event.tasks);
            }
            break;
          default:
            if (graphClient?.send) {
              graphClient.send(event);
            }
        }

        return service.send(event);
      },
      receive: (callback: (event: any) => void) => {
        // Set up event listeners for task events
        on('taskClick', callback);
        on('taskRun', callback);
        on('taskComplete', callback);
        on('backgroundClick', callback);
        on('ready', callback);
      },
      on, // Expose the on method for custom events
      emit, // Expose emit for triggering custom events
      getState: () => service.state.value,
      getGraphClient: () => graphClient,
    };
  };
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
