import { AppConfig } from '../app/app';

export const environment: { release: boolean; appConfig: AppConfig } = {
  release: true,
  appConfig: {
    showDebugger: false,
  },
};
