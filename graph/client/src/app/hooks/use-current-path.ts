import { matchRoutes, useLocation } from 'react-router-dom';
import { getRoutesForEnvironment } from '../routes';
import { getEnvironmentConfig } from './use-environment-config';

export const useCurrentPath = () => {
  const location = useLocation();
  const route = matchRoutes(getRoutesForEnvironment(), location).at(-1);

  const { environment } = getEnvironmentConfig();

  // if using dev routes, remove first segment for workspace
  if (environment === 'dev') {
    return {
      workspace: route.pathname.split('/')[1],
      currentPath: `/${route.pathname.split('/').slice(2).join('/')}`,
    };
  } else {
    return { workspace: 'local', currentPath: route.pathname };
  }
};
