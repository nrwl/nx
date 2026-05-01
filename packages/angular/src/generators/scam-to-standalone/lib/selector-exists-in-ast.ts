import type { SourceFile } from 'typescript';

export function selectorExistsInAST(selector: string, sourceFile: SourceFile) {
  const { query } = require('@phenomnomnominal/tsquery');
  return query(sourceFile, selector).length > 0;
}
