import {
  getTypescriptAst,
  requireClassicTypescript,
  type TypescriptAst,
} from 'nx/src/devkit-internals';
import { ensurePackage } from './package-json';
import { typescriptVersion } from './versions';

/**
 * Returns {@link TypescriptAst} for the workspace's TypeScript. When the
 * workspace has no TypeScript, installs `typescriptVersion` to a temporary
 * directory first.
 */
export function ensureTypescript(): TypescriptAst {
  // @nx/devkit's nx peer range includes versions without getTypescriptAst.
  // Those do not support TypeScript 7.1, so the module itself is the AST.
  if (typeof getTypescriptAst !== 'function') {
    return ensurePackage<TypescriptAst>('typescript', typescriptVersion);
  }
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
