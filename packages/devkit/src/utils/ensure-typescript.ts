import {
  getTypescriptAst,
  requireClassicTypescript,
  type TypescriptAst,
  useTemporaryTypescript,
} from 'nx/src/devkit-internals';
import { ensurePackage, installToTemporaryDirectory } from './package-json';
import { typescriptVersion } from './versions';

/**
 * Returns {@link TypescriptAst} for the workspace's TypeScript. When the
 * workspace has no TypeScript, installs `typescriptVersion` to a temporary
 * directory first.
 */
export function ensureTypescript(): TypescriptAst {
  if (typeof getTypescriptAst !== 'function') {
    return loadTypescriptWithoutAdapter();
  }
  try {
    return getTypescriptAst();
  } catch (e) {
    if (e?.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
  }
  // The adapter only searches the workspace and the nx installation, so it is
  // told where the temporary copy is.
  const tempDir = installToTemporaryDirectory('typescript', typescriptVersion);
  useTemporaryTypescript(
    require.resolve('typescript/package.json', { paths: [tempDir] })
  );
  return getTypescriptAst();
}

/**
 * Loads the TypeScript module for an nx without the TypeScript adapter, which
 * @nx/devkit's nx peer range includes. Such an nx predates TypeScript 7.1.
 */
export function loadTypescriptWithoutAdapter(): typeof import('typescript') {
  const ts = ensurePackage<typeof import('typescript')>(
    'typescript',
    typescriptVersion
  );
  if (typeof ts.createSourceFile !== 'function') {
    throw new Error(
      `The installed nx does not support TypeScript ${ts.version}. Update nx to match @nx/devkit, or install TypeScript 6 as "typescript".`
    );
  }
  return ts;
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
