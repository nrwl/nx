import { Mode } from '@rspack/core';

export function isMode(mode: string): mode is Mode {
  return mode === 'development' || mode === 'production' || mode === 'none';
}
