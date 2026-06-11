import { getDependencyVersionFromPackageJson, Tree } from '@nx/devkit';
import { join } from 'path';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';

export const nxVersion = require(join('@nx/remix', 'package.json')).version;

// @nx/remix supports Remix v2 only. React Router v7 (the successor to Remix) is
// handled by @nx/react. The floor rejects Remix v1; v2 is the only supported major.
export const minSupportedRemixVersion = '2.0.0';

export function assertSupportedRemixVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    '@remix-run/dev',
    minSupportedRemixVersion
  );
}

export const remixVersion = '^2.17.3';
export const isbotVersion = '^4.4.0';
export const reactVersion = '^18.2.0';
export const reactDomVersion = '^18.2.0';
export const typesReactVersion = '^18.2.0';
export const typesReactDomVersion = '^18.2.0';
export const eslintVersion = '^8.56.0';
export const typescriptVersion = '~5.9.2';
export const postcssVersion = '^8.4.38';
export const autoprefixerVersion = '^10.4.19';
export const testingLibraryReactVersion = '^14.1.2';
// TODO(colum): Unpin this when @testing-library/jest-dom pushes a fix
export const testingLibraryJestDomVersion = '6.4.2';
export const testingLibraryDomVersion = '^10.4.0';
export const testingLibraryUserEventsVersion = '^14.5.2';
export const viteVersion = '^6.0.0';

export function getRemixVersion(tree: Tree): string {
  return (
    getDependencyVersionFromPackageJson(tree, '@remix-run/dev') ?? remixVersion
  );
}
