/**
 * Adapted from the original ng-packagr.
 *
 * Changes made:
 * - Use our own options interface to add support for tailwindConfig.
 */

import * as findCacheDirectory from 'find-cache-dir';
import { InjectionToken, Provider, ValueProvider } from 'injection-js';
import { NgPackagrOptions as NgPackagrOptionsBase } from 'ng-packagr/lib/ng-package/options.di';
import { tmpdir } from 'os';
import { resolve } from 'path';

export interface NgPackagrOptions extends NgPackagrOptionsBase {
  tailwindConfig?: string;
}

export const NX_OPTIONS_TOKEN = new InjectionToken<NgPackagrOptions>(
  `nx.v1.options`
);

export const nxProvideOptions = (
  options: NgPackagrOptions = {}
): ValueProvider => ({
  provide: NX_OPTIONS_TOKEN,
  useValue: normalizeOptions(options),
});

export const NX_DEFAULT_OPTIONS_PROVIDER: Provider = nxProvideOptions();

function normalizeOptions(options: NgPackagrOptions = {}) {
  const ciEnv = process.env['CI'];
  const isCI = ciEnv?.toLowerCase() === 'true' || ciEnv === '1';
  const { cacheEnabled = !isCI, cacheDirectory = findCachePath() } = options;

  return {
    ...options,
    cacheEnabled,
    cacheDirectory,
  };
}

function findCachePath(): string {
  const name = 'ng-packagr';

  return findCacheDirectory({ name }) || resolve(tmpdir(), name);
}
