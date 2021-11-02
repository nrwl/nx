import { lt } from 'semver';

export function assertCompatibleStorybookVersion() {
  let storybookVersion: string;
  try {
    storybookVersion = require(require.resolve(
      '@storybook/angular/package.json'
    )).version;
  } catch {}

  if (storybookVersion && lt(storybookVersion, '6.2.0')) {
    throw new Error('Incompatible Storybook Version');
  }
}
