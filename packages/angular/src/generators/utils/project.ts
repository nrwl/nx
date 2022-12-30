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
  if (npmScope && !htmlSelectorRegex.test(npmScope)) {
    throw new Error(`The "--prefix" option was not provided, therefore attempted to use the "npmScope" defined in "nx.json" to set the application's selector prefix, but it is invalid.

There are two options that can be followed to resolve this issue:
  - Pass a valid "--prefix" option.
  - Update the "npmScope" in "nx.json" (Note: this can be an involved process, as other libraries and applications may need to be updated to match the new scope).

If you encountered this error when creating a new Nx Workspace, the workspace name or "npmScope" is invalid to use as the selector prefix for the application being generated.

Valid selector prefixes must start with a letter, and must contain only alphanumeric characters or dashes. When adding a dash the segment after the dash must also start with a letter.`);
  }

  return npmScope || 'app';
}
