/* eslint-disable import/first */
// debug must be first import
if (process.env.NODE_ENV === 'development') {
  require('preact/debug');
}

import { StrictMode } from 'react';
import { inspect } from '@xstate/inspect';
import { App } from './app/app';
import { ExternalApiImpl } from './app/external-api-impl';
import { render } from 'preact';
import { ErrorToastUI, ExpandedTargetsProvider } from '@nx/graph/shared';
import { ProjectDetails } from '@nx/graph-internal/ui-project-details';
import { ErrorPage } from './app/ui-components/error-page';

if (window.__NX_RENDER_GRAPH__ === false) {
  window.renderPDV = (data: any) => {
    const container = document.getElementById('app');
    render(
      <StrictMode>
        <ExpandedTargetsProvider>
          <ProjectDetails {...data} />
        </ExpandedTargetsProvider>
        <ErrorToastUI errors={data.errors} />
      </StrictMode>,
      container
    );
  };

  window.renderError = (data: any) => {
    const container = document.getElementById('app');
    render(
      <StrictMode>
        <ErrorPage {...data} />
      </StrictMode>,
      container
    );
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
