// This file can be replaced during build by using the `fileReplacements` array.
// When building for production, this file is replaced with `environment.prod.ts`.

import { AppConfig } from '../app/app';

export const environment: { release: boolean; appConfig: AppConfig } = {
  release: false,
  appConfig: {
    showDebugger: true,
  },
};
