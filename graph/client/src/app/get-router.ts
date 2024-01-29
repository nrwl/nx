import { createBrowserRouter, createHashRouter } from 'react-router-dom';
import { getRoutesForEnvironment } from './routes';
import { getEnvironmentConfig } from '@nx/graph/shared';

let router;

export function getRouter() {
  if (!router) {
    const environmentConfig = getEnvironmentConfig();
    let routerCreate = createBrowserRouter;
    if (
      environmentConfig.localMode === 'build' ||
      environmentConfig.environment === 'nx-console'
    ) {
      routerCreate = createHashRouter;
    }

    router = routerCreate(getRoutesForEnvironment());
  }

  return router;
}
