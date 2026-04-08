import { lt } from 'semver';

export function assertCompatibleStorybookVersion() {
  let storybookVersion: string;
  try {
    storybookVersion = require(
      require.resolve('@storybook/angular/package.json')
    ).version;
  } catch {}

  if (storybookVersion && lt(storybookVersion, '8.0.0')) {
    throw new Error(
      'Incompatible Storybook Version: Please use a version 8.0.0 or higher of @storybook/angular'
    );
  }
}
