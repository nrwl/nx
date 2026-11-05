import { ensurePackage } from '@nx/devkit';
import {
  getTypescriptAst,
  requireClassicTypescript,
  type TypescriptAst,
} from '@nx/devkit/internal';
import { typescriptVersion } from '../versions';

/**
 * Returns {@link TypescriptAst} for the workspace's TypeScript. When the
 * workspace has no TypeScript, installs `typescriptVersion` to a temporary
 * directory first.
 */
export function ensureTypescript(): TypescriptAst {
  try {
    return getTypescriptAst();
  } catch (e) {
    if (e?.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
  }
  ensurePackage('typescript', typescriptVersion);
  return getTypescriptAst();
}

/**
 * Like {@link ensureTypescript}, but returns the whole TypeScript module, so it
 * throws a `TypescriptSetupError` naming `feature` when the workspace's
 * TypeScript only provides the 7.1 API.
 */
export function ensureClassicTypescript(
  feature: string
): typeof import('typescript') {
  ensureTypescript();
  return requireClassicTypescript(feature);
}
