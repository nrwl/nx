import { rspackVersion } from '@rspack/core';

export function getRspackMajorVersion(): number {
  return parseInt(rspackVersion ?? '1', 10);
}

export function isRspackV2(): boolean {
  return getRspackMajorVersion() >= 2;
}
