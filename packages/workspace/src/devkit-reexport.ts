import { names } from '@nrwl/devkit';

export { offsetFromRoot, names } from '@nrwl/devkit';

export function toPropertyName(value: string) {
  return names(value).propertyName;
}

export function toClassName(value: string) {
  return names(value).className;
}

export function toFileName(value: string) {
  return names(value).fileName;
}
