/* eslint-disable import/first */
// debug must be first import
if (process.env.NODE_ENV === 'development') {
  require('preact/debug');
}

import { StrictMode } from 'react';
import { render } from 'preact';
import { ProjectDetails } from '@nx/graph-internal/ui-project-details';

const container = document.getElementById('app');

render(
  <StrictMode>
    <ProjectDetails project={(window as any).__project as any} sourceMap={(window as any).__sourceMap}></ProjectDetails>
  </StrictMode>,
  container
);
