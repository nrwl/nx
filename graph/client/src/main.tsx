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
import { interpret } from 'xstate';
import { MigrateApp } from './app/console-migrate/migrate.app';
import { migrateMachine } from './app/console-migrate/migrate.machine';

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
