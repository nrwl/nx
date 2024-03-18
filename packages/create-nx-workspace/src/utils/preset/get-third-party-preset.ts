import { output } from '../output';
import { validateNpmPackage } from '../validate-npm-package';
import { isKnownPreset } from './preset';

/**
 * This function is used to check if a preset is a third party preset.
 * @param preset
 * @returns null if the preset is a known Nx preset or preset does not exist, the package name of preset otherwise.
 */
export async function getThirdPartyPreset(
  preset?: string
): Promise<string | null> {
  if (preset && !isKnownPreset(preset)) {
    // extract the package name from the preset
    const packageName = preset.match(/.+@/)
      ? preset[0] + preset.substring(1).split('@')[0]
      : preset;
    const validateResult = validateNpmPackage(packageName);
    if (validateResult.validForNewPackages) {
      return Promise.resolve(packageName);
    } else {
      //! Error here
      output.error({
        title: 'Invalid preset npm package',
        bodyLines: [
          `There was an error with the preset npm package you provided:`,
          '',
          ...(validateResult.errors ?? []),
        ],
      });
      throw new Error('Invalid preset npm package');
    }
  } else {
    return Promise.resolve(null);
  }
}
