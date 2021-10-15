import { WebBuildExecutorOptions } from '../executors/build/build.impl';

export function buildServePath(browserOptions: WebBuildExecutorOptions) {
  let servePath =
    _findDefaultServePath(browserOptions.baseHref, browserOptions.deployUrl) ||
    '/';
  if (servePath.endsWith('/')) {
    servePath = servePath.substr(0, servePath.length - 1);
  }
  if (!servePath.startsWith('/')) {
    servePath = `/${servePath}`;
  }

  return servePath;
}

export function _findDefaultServePath(
  baseHref?: string,
  deployUrl?: string
): string | null {
  if (!baseHref && !deployUrl) {
    return '';
  }

  if (
    /^(\w+:)?\/\//.test(baseHref || '') ||
    /^(\w+:)?\/\//.test(deployUrl || '')
  ) {
    // If baseHref or deployUrl is absolute, unsupported by nx serve
    return null;
  }

  // normalize baseHref
  // for nx serve the starting base is always `/` so a relative
  // and root relative value are identical
  const baseHrefParts = (baseHref || '')
    .split('/')
    .filter((part) => part !== '');
  if (baseHref && !baseHref.endsWith('/')) {
    baseHrefParts.pop();
  }
  const normalizedBaseHref =
    baseHrefParts.length === 0 ? '/' : `/${baseHrefParts.join('/')}/`;

  if (deployUrl && deployUrl[0] === '/') {
    if (baseHref && baseHref[0] === '/' && normalizedBaseHref !== deployUrl) {
      // If baseHref and deployUrl are root relative and not equivalent, unsupported by nx serve
      return null;
    }

    return deployUrl;
  }

  // Join together baseHref and deployUrl
  return `${normalizedBaseHref}${deployUrl || ''}`;
}
