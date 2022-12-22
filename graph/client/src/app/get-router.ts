import { createBrowserRouter, createHashRouter } from 'react-router-dom';
import { getRoutesForEnvironment } from './routes';
import { getEnvironmentConfig } from './hooks/use-environment-config';

let router;

export function getRouter() {
  if (!router) {
    const environmentConfig = getEnvironmentConfig();

    let routerCreate = createBrowserRouter;
    if (environmentConfig.localMode === 'build') {
      routerCreate = createHashRouter;
    }

    router = routerCreate(getRoutesForEnvironment());
  }

  return router;
}
