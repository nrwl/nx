import { StrictMode } from 'react';
import { render } from 'react-dom';
import { inspect } from '@xstate/inspect';
import { App } from './app/app';
import { ExternalApi } from './app/external-api';

if (window.useXstateInspect === true) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false, // open in new window
  });
}

window.externalApi = new ExternalApi();

if (!window.appConfig) {
  render(
    <p>
      No environment could be found. Please run{' '}
      <pre>npx nx run graph-client:generate-dev-environment-js</pre>.
    </p>,
    document.getElementById('app')
  );
} else {
  render(
    <StrictMode>
      <App />
    </StrictMode>,
    document.getElementById('app')
  );
}
