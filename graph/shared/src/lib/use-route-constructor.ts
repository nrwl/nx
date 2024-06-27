import { To, useParams, useSearchParams } from 'react-router-dom';
import { getEnvironmentConfig } from './use-environment-config';

export const useRouteConstructor = (): ((
  to: To,
  retainSearchParams: boolean,
  searchParamsKeysToOmit?: string[]
) => To) => {
  const { environment } = getEnvironmentConfig();
  const { selectedWorkspaceId } = useParams();
  const [searchParams] = useSearchParams();

  return (
    to: To,
    retainSearchParams: boolean = true,
    searchParamsKeysToOmit: string[] = []
  ) => {
    if (searchParamsKeysToOmit?.length) {
      searchParamsKeysToOmit.forEach((key) => {
        searchParams.delete(key);
      });
    }
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
