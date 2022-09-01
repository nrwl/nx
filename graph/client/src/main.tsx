import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom';
import { inspect } from '@xstate/inspect';
import App from './app/app';
import { ExternalApi } from './app/machines/externalApi';

if (window.useXstateInspect === true) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false, // open in new window
  });
}

window.externalApi = new ExternalApi();

ReactDOM.render(
  <StrictMode>
    <App />
  </StrictMode>,
  document.getElementById('app')
);
