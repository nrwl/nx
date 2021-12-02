import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom';
import { inspect } from '@xstate/inspect';
import App from './app/app';

if (window.useXstateInspect === true) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false, // open in new window
  });
}

ReactDOM.render(
  <StrictMode>
    <App />
  </StrictMode>,
  document.getElementById('app')
);
