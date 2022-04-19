export const workspaceMigrationErrorHeading =
  'The workspace cannot be migrated because of the following issues:';

export function arrayToString(array: string[]): string {
  if (array.length === 0) {
    return '';
  }

  if (array.length === 1) {
    return quote(array[0]);
  }

  const last = array[array.length - 1];
  const rest = array.slice(0, array.length - 1);
  return `${rest.map(quote).join(', ')} and ${quote(last)}`;
}

function quote(str: string): string {
  return `"${str}"`;
}
