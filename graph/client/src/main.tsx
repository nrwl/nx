import { StrictMode } from 'react';
import { inspect } from '@xstate/inspect';
import { App } from './app/app';
import { ExternalApi } from './app/external-api';
import { render } from 'preact';

if (window.useXstateInspect === true) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false, // open in new window
  });
}

window.externalApi = new ExternalApi();
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
