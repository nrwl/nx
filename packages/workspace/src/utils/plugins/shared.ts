// Lifted in part from https://github.com/nrwl/angular-console

export function hasElements(obj: any): boolean {
  return obj && Object.values(obj).length > 0;
}
