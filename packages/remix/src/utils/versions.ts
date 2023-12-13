import { readJson, Tree } from '@nx/devkit';

export const nxVersion = require('../../package.json').version;

export const remixVersion = '^2.3.0';
export const isbotVersion = '^3.6.8';
export const reactVersion = '^18.2.0';
export const reactDomVersion = '^18.2.0';
export const typesReactVersion = '^18.2.0';
export const typesReactDomVersion = '^18.2.0';
export const eslintVersion = '^8.38.0';
export const typescriptVersion = '^5.1.6';
export const tailwindVersion = '^3.3.0';
export const testingLibraryReactVersion = '^14.1.2';
export const testingLibraryJestDomVersion = '^6.1.4';
export const testingLibraryUserEventsVersion = '^14.5.1';

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
