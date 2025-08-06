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
    // Create a simple state machine service for external control
    const stateMachine = createMachine({
      id: 'projectGraph',
      initial: 'idle',
      states: {
        idle: {
          on: {
            RENDER: 'rendering',
            UPDATE: 'updating',
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
      },
    });

    const service = interpret(stateMachine).start();
    let graphClient: any = null;

    render(
      <StrictMode>
        <StandaloneProjectGraph
          projectData={projectData}
          onGraphReady={(client) => {
            graphClient = client;
            service.send('COMPLETE');
          }}
        />
      </StrictMode>,
      document.getElementById('app')
    );

    // Return service with send/receive capabilities
    return {
      service,
      send: (event: any) => {
        if (graphClient) {
          graphClient.send(event);
        }
        return service.send(event);
      },
      receive: (callback: (event: any) => void) => {
        if (graphClient) {
          graphClient.on('*', callback);
        }
      },
    };
  };

  window.renderTaskGraph = (taskData: any) => {
    // Create a simple state machine service for external control
    const stateMachine = createMachine({
      id: 'taskGraph',
      initial: 'idle',
      states: {
        idle: {
          on: {
            RENDER: 'rendering',
            UPDATE: 'updating',
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
      },
    });

    const service = interpret(stateMachine).start();
    let graphClient: any = null;

    render(
      <StrictMode>
        <StandaloneTaskGraph
          taskData={taskData}
          onGraphReady={(client) => {
            graphClient = client;
            service.send('COMPLETE');
          }}
        />
      </StrictMode>,
      document.getElementById('app')
    );

    // Return service with send/receive capabilities
    return {
      service,
      send: (event: any) => {
        if (graphClient) {
          graphClient.send(event);
        }
        return service.send(event);
      },
      receive: (callback: (event: any) => void) => {
        if (graphClient) {
          graphClient.on('*', callback);
        }
      },
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
