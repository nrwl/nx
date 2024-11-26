import { validateNpmPackage } from '../validate-npm-package';
import { isKnownPreset } from './preset';

/**
 * This function is used to check if a preset is a third party preset.
 * @param preset
 * @returns
 * - undefined if the preset is a known Nx preset or invalid.
 * - packageName if the preset is a third party preset.
 * - throws an error if the preset is invalid.
 */
export function getPackageNameFromThirdPartyPreset(
  preset?: string
): string | undefined {
  if (!preset || isKnownPreset(preset)) {
    return;
  }
  // extract the package name from the preset
  const packageName = preset.match(/.+@/)
    ? preset[0] + preset.substring(1).split('@')[0]
    : preset;

  const validateResult = validateNpmPackage(packageName);
  if (!validateResult.validForNewPackages) {
    throw new Error(
      `Invalid preset npm package ${packageName}. There was an error with the preset npm package you provided: ` +
        (validateResult.errors ?? []).join('\n')
    );
  }
  return packageName;
}
