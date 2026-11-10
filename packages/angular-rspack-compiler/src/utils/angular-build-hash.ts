import { requireAngularBuildFile } from './angular-build-file';
import { isAngularBuildVersionAtLeast } from './angular-build-version';

/**
 * Initializes the hashing that `@angular/build` >= 22.2 tools assert on. Its
 * builders run this at startup; it is not exported, so it is loaded by path,
 * which shares the module instance those tools use.
 */
export async function initializeAngularBuildHash(): Promise<void> {
  if (!isAngularBuildVersionAtLeast('22.2.0')) {
    return;
  }

  const { initializeHash }: { initializeHash: () => Promise<void> } =
    requireAngularBuildFile('src/utils/hash.js');
  await initializeHash();
}
