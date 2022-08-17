import { SourceFile } from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';

export function selectorExistsInAST(selector: string, ast: SourceFile) {
  return tsquery(ast, selector, { visitAllChildren: true }).length > 0;
}
