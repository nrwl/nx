import { lt } from 'semver';

export function assertCompatibleStorybookVersion() {
  let storybookVersion: string;
  try {
    storybookVersion = require(require.resolve(
      '@storybook/angular/package.json'
    )).version;
  } catch {}

  if (storybookVersion && lt(storybookVersion, '6.4.0-rc.1')) {
    throw new Error(
      'Incompatible Storybook Version: Please use a version of @storybook/angular higher than 6.4.0-rc.1'
    );
  }
}
