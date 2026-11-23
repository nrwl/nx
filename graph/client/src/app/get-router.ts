import { createBrowserRouter, createHashRouter } from 'react-router-dom';
import { getRoutesForEnvironment } from './routes';
import { getEnvironmentConfig } from '@nx/graph-shared';

export type AppRouter = ReturnType<typeof createBrowserRouter>;

let router: AppRouter | undefined;

export function getRouter(): AppRouter {
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
