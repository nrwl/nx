import { rspackVersion } from '@rspack/core';

/**
 * Returns the major version of the installed `@rspack/core`. Defaults to 1
 * when the version cannot be read.
 */
export function getRspackMajorVersion(): number {
  return parseInt(rspackVersion ?? '1', 10);
}

/** True when the installed `@rspack/core` is v2 or newer. */
export function isRspackV2(): boolean {
  return getRspackMajorVersion() >= 2;
}
