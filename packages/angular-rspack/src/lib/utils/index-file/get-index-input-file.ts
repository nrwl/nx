import type { IndexExpandedDefinition } from '../../models';

export function getIndexInputFile(index: IndexExpandedDefinition): string {
  if (typeof index === 'string') {
    return index;
  }

  return index.input;
}
