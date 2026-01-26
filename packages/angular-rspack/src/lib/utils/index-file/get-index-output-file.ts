import type { IndexExpandedDefinition } from '../../models';
import { basename } from 'node:path';

export function getIndexOutputFile(index: IndexExpandedDefinition): string {
  if (typeof index === 'string') {
    return basename(index);
  }

  return index.output || 'index.html';
}
