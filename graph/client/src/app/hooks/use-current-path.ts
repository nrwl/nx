import { matchRoutes, useLocation } from 'react-router-dom';
import { getRoutesForEnvironment } from '../routes';
import { useState } from 'react';
import { getEnvironmentConfig } from '@nx/graph-shared';

interface CurrentPath {
  workspace: string;
  currentPath: string;
}

export const useCurrentPath = (): CurrentPath => {
  const [last, setLast] = useState<{ location: string; path: CurrentPath }>();

  const location = useLocation();

  if (last && location.pathname === last.location) {
    return last.path;
  }

  const route = matchRoutes(getRoutesForEnvironment(), location)?.at(-1);
  if (!route) {
    throw new Error(`No route matches ${location.pathname}`);
  }

  const { environment } = getEnvironmentConfig();

  let currentPath: CurrentPath;
  // if using dev routes, remove first segment for workspace
  if (environment === 'dev') {
    currentPath = {
      workspace: route.pathname.split('/')[1],
      currentPath: `/${route.pathname.split('/').slice(2).join('/')}`,
    };
  } else {
    currentPath = { workspace: 'local', currentPath: route.pathname };
  }
  setLast({ location: location.pathname, path: currentPath });
  return currentPath;
};
