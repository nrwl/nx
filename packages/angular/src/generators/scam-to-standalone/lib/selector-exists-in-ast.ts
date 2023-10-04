import type { SourceFile } from 'typescript';

export function selectorExistsInAST(selector: string, ast: SourceFile) {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  return tsquery(ast, selector, { visitAllChildren: true }).length > 0;
}
