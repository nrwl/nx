import type { PackageManager } from '@nx/devkit';
import type { JsonInput } from '@nx/devkit/internal';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Task inputs covering the root package.json fields a pruned Bun deploy output
 * is built from: `trustedDependencies` (the packages allowed to run install
 * scripts) and `patchedDependencies` (the patches it declares and ships).
 * Nothing else in a build target's default hash moves when a package is
 * untrusted, so a target that emits the deploy output must hash these or a
 * cached run replays an output that still trusts it. The patch contents reach
 * the hash through the patched packages' external nodes. The manifest is
 * narrowed to these fields so dependency bumps in the root package.json do
 * not invalidate every build.
 */
export const BUN_INSTALL_SETTINGS_INPUTS: JsonInput[] = [
  {
    json: '{workspaceRoot}/package.json',
    fields: ['trustedDependencies', 'patchedDependencies'],
  },
];

/**
 * Whether an inferred build target needs {@link BUN_INSTALL_SETTINGS_INPUTS}:
 * the workspace uses Bun with the text bun.lock. On the binary bun.lockb the
 * deploy output is the manifest alone, without the trust list or patches.
 */
export function shouldIncludeBunInstallSettingsInputs(
  packageManager: PackageManager,
  workspaceRoot: string
): boolean {
  return (
    packageManager === 'bun' && existsSync(join(workspaceRoot, 'bun.lock'))
  );
}
