import { names } from '@nx/devkit';

export function buildSelector(
  name: string,
  prefix: string | undefined,
  projectPrefix: string | undefined,
  casing: keyof Pick<ReturnType<typeof names>, 'fileName' | 'propertyName'>
): string {
  let selector = name;
  prefix ??= projectPrefix;
  if (prefix) {
    selector = `${prefix}-${selector}`;
  }

  return names(selector)[casing];
}

// https://github.com/angular/angular-cli/blob/main/packages/schematics/angular/utility/validation.ts#L11-L14
const htmlSelectorRegex =
  /^[a-zA-Z][.0-9a-zA-Z]*((:?-[0-9]+)*|(:?-[a-zA-Z][.0-9a-zA-Z]*(:?-[0-9]+)*)*)$/;

export function validateHtmlSelector(selector: string): void {
  if (selector && !htmlSelectorRegex.test(selector)) {
    throw new Error(`The selector "${selector}" is invalid.`);
  }
}
