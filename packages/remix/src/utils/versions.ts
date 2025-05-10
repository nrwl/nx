import { readJson, Tree } from '@nx/devkit';

export const nxVersion = require('../../package.json').version;

export const remixVersion = '^2.15.0';
export const isbotVersion = '^4.4.0';
export const reactVersion = '^18.2.0';
export const reactDomVersion = '^18.2.0';
export const typesReactVersion = '^18.2.0';
export const typesReactDomVersion = '^18.2.0';
export const eslintVersion = '^8.56.0';
export const typescriptVersion = '~5.8.2';
export const tailwindVersion = '^3.3.0';
export const postcssVersion = '^8.4.38';
export const autoprefixerVersion = '^10.4.19';
export const testingLibraryReactVersion = '^14.1.2';
// TODO(colum): Unpin this when @testing-library/jest-dom pushes a fix
export const testingLibraryJestDomVersion = '6.4.2';
export const testingLibraryDomVersion = '^10.4.0';
export const testingLibraryUserEventsVersion = '^14.5.2';
export const viteVersion = '^5.0.0';

export function getRemixVersion(tree: Tree): string {
  return getPackageVersion(tree, '@remix-run/dev') ?? remixVersion;
}

export function getPackageVersion(tree: Tree, packageName: string) {
  const packageJsonContents = readJson(tree, 'package.json');
  return (
    packageJsonContents?.['devDependencies']?.[packageName] ??
    packageJsonContents?.['dependencies']?.[packageName] ??
    null
  );
}
