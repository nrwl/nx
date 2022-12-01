import { matchRoutes, useLocation } from 'react-router-dom';
import { getRoutesForEnvironment } from '../routes';
import { getEnvironmentConfig } from './use-environment-config';
import { useState } from 'react';

export const useCurrentPath = () => {
  const [lastLocation, setLastLocation] = useState<string>();
  const [lastPath, setLastPath] = useState();

  const location = useLocation();

  if (location.pathname === lastLocation) {
    return lastPath;
  }

  setLastLocation(location.pathname);

  const route = matchRoutes(getRoutesForEnvironment(), location).at(-1);

  const { environment } = getEnvironmentConfig();

  let currentPath;
  // if using dev routes, remove first segment for workspace
  if (environment === 'dev') {
    currentPath = {
      workspace: route.pathname.split('/')[1],
      currentPath: `/${route.pathname.split('/').slice(2).join('/')}`,
    };
  } else {
    currentPath = { workspace: 'local', currentPath: route.pathname };
  }
  setLastPath(currentPath);
  return currentPath;
};
