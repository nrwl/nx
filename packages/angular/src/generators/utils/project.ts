import { names } from '@nrwl/devkit';

export function normalizeDirectory(
  appName: string,
  directoryName: string
): string {
  return directoryName
    ? `${names(directoryName).fileName}/${names(appName).fileName}`
    : names(appName).fileName;
}

export function normalizeProjectName(
  appName: string,
  directoryName: string
): string {
  return normalizeDirectory(appName, directoryName).replace(/\//g, '-');
}

export function normalizePrefix(
  prefix: string | undefined,
  npmScope: string | undefined
): string {
  if (prefix) {
    return prefix;
  }

  // Prefix needs to be a valid html selector, if npmScope it's not valid, we don't default
  // to it and let it fall through to the Angular schematic to handle it
  // https://github.com/angular/angular-cli/blob/1c634cd327e5a850553b258aa2d5e6a6b2c75c65/packages/schematics/angular/component/index.ts#L130
  const htmlSelectorRegex =
    /^[a-zA-Z][.0-9a-zA-Z]*(:?-[a-zA-Z][.0-9a-zA-Z]*)*$/;
  return npmScope && htmlSelectorRegex.test(npmScope) ? npmScope : undefined;
}
