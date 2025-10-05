import { To, useParams, useSearchParams } from 'react-router-dom';
import { getEnvironmentConfig } from './use-environment-config';

export const useRouteConstructor = (): ((
  to: To,
  retainSearchParams:
    | boolean
    | ((searchParams: URLSearchParams) => URLSearchParams),
  searchParamsKeysToOmit?: string[]
) => To) => {
  const { environment } = getEnvironmentConfig();
  const { selectedWorkspaceId } = useParams();
  const [searchParams] = useSearchParams();

  return (
    to: To,
    retainSearchParams = true,
    searchParamsKeysToOmit: string[] = []
  ) => {
    if (searchParamsKeysToOmit?.length) {
      searchParamsKeysToOmit.forEach((key) => {
        searchParams.delete(key);
      });
    }
    let pathname: string | undefined = '';

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
          : getSearchParams(retainSearchParams, searchParams),
      };
    } else {
      if (environment === 'dev') {
        pathname = `/${selectedWorkspaceId}${to}`;
      } else {
        pathname = to;
      }
      return {
        pathname,
        search: getSearchParams(retainSearchParams, searchParams),
      };
    }
  };
};

function getSearchParams(
  retainSearchParams:
    | boolean
    | ((searchParams: URLSearchParams) => URLSearchParams),
  searchParams: URLSearchParams
) {
  return typeof retainSearchParams === 'function'
    ? retainSearchParams(searchParams).toString()
    : retainSearchParams
    ? searchParams.toString()
    : '';
}
