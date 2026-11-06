import type { LoaderContext, RuleSetRule } from '@rspack/core';

const DEV_CLIENT_GUARD_QUERY = 'ngrs-window-only';

export function getDevClientGuardRule(): RuleSetRule {
  return {
    test: [
      /[\\/]@rspack[\\/]dev-server[\\/]client[\\/]index\.js$/,
      /[\\/]@rspack[\\/]core[\\/]hot[\\/](only-)?dev-server\.js$/,
    ],
    resourceQuery: { not: new RegExp(DEV_CLIENT_GUARD_QUERY) },
    // The wrapper is CommonJS whatever the wrapped package's module type.
    type: 'javascript/auto',
    loader: __filename,
  };
}

/**
 * The dev server adds its client and HMR entries to every entrypoint and
 * compiler, where outside a page they open their own socket and try to reload
 * `self`. This runs them only when a document exists.
 */
export default function devClientGuardLoader(this: LoaderContext): string {
  const separator = this.resourceQuery ? '&' : '?';
  const request = `${this.resourcePath}${this.resourceQuery}${separator}${DEV_CLIENT_GUARD_QUERY}`;
  return `if (typeof document !== 'undefined') {\n  require(${JSON.stringify(request)});\n}\n`;
}
