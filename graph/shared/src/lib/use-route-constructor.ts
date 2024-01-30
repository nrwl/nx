import { To, useParams, useSearchParams } from 'react-router-dom';
import { getEnvironmentConfig } from './use-environment-config';

export const useRouteConstructor = (): ((
  to: To,
  retainSearchParams: boolean
) => To) => {
  const { environment } = getEnvironmentConfig();
  const { selectedWorkspaceId } = useParams();
  const [searchParams] = useSearchParams();

  return (to: To, retainSearchParams: true) => {
    let pathname = '';

    if (typeof to === 'object') {
      if (environment === 'dev') {
        pathname = `/${selectedWorkspaceId}${to.pathname}`;
      } else {
        pathname = to.pathname;
      }
      return {
        ...to,
        pathname,
        search: to.search
          ? to.search.toString()
          : retainSearchParams
          ? searchParams.toString()
          : '',
      };
    } else if (typeof to === 'string') {
      if (environment === 'dev') {
        pathname = `/${selectedWorkspaceId}${to}`;
      } else {
        pathname = to;
      }
      return {
        pathname,
        search: retainSearchParams ? searchParams.toString() : '',
      };
    }
  };
};
