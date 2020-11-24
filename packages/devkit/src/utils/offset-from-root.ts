import { normalize } from 'path';

export function offsetFromRoot(fullPathToSourceDir: string): string {
  // original offsetFromRoot used @angular-devkit/core's normalize.
  const parts = normalize(fullPathToSourceDir).split('/');
  let offset = '';
  for (let i = 0; i < parts.length; ++i) {
    offset += '../';
  }
  return offset;
}
